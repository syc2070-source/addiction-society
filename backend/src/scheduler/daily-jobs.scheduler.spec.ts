import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DAILY_STEPS,
  DailyJobsScheduler,
  StepResult,
} from './daily-jobs.scheduler';
import { toBroadcastRows } from '../sources/broadcast.util';

// SOC-R1 ■4 — 배포는 migration + 멱등 seed 만, 덮어쓰는 단계는 매일 예약으로.
const MOVED = [
  'seed:sources',
  'backfill:next',
  'seed:recovery',
  'collect:indicators',
  'seed:documents',
  'collect:research',
];

describe('deploy-init.sh', () => {
  const script = readFileSync(
    join(__dirname, '..', '..', 'scripts', 'deploy-init.sh'),
    'utf8',
  );
  const commands = script
    .split('\n')
    .filter((l) => /^\s*(soft_)?step\s/.test(l))
    .join('\n');

  it('runs only migration:run and seed:tags', () => {
    expect(commands).toContain('npm run migration:run');
    expect(commands).toContain('npm run seed:tags');
    for (const name of MOVED) expect(commands).not.toContain(`npm run ${name}`);
  });
});

describe('DAILY_STEPS', () => {
  const names = DAILY_STEPS.map((s) => s.name);

  it('carries every step removed from deploy-init (nothing switched off)', () => {
    for (const name of MOVED) expect(names).toContain(name);
  });

  it('runs backfill:next right after seed:sources', () => {
    expect(names.indexOf('backfill:next')).toBe(
      names.indexOf('seed:sources') + 1,
    );
  });

  it('fills relevance after collect:research and pulls broadcasts', () => {
    expect(names.indexOf('backfill:relevance')).toBeGreaterThan(
      names.indexOf('collect:research'),
    );
    expect(names).toContain('collect:broadcasts');
  });

  it('every entry is a real script with an npm alias', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    for (const s of DAILY_STEPS) {
      expect(pkg.scripts[s.name]).toBe(`ts-node src/${s.entry}.ts`);
    }
  });
});

describe('DailyJobsScheduler.runAll', () => {
  const ok = (name: string): StepResult => ({
    name,
    ok: true,
    code: 0,
    ms: 1,
    tail: '',
  });

  it('keeps going after a failure and sends one Discord alert', async () => {
    const notifier = { notifyText: jest.fn() };
    const s = new DailyJobsScheduler(notifier as never);
    const steps = [
      { name: 'a', entry: 'x/a' },
      { name: 'b', entry: 'x/b' },
      { name: 'c', entry: 'x/c' },
    ];
    const ran: string[] = [];
    const results = await s.runAll(steps, (step) => {
      ran.push(step.name);
      if (step.name === 'b') {
        return Promise.resolve({
          name: 'b',
          ok: false,
          code: 1,
          ms: 1,
          tail: 'boom',
        });
      }
      return Promise.resolve(ok(step.name));
    });
    expect(ran).toEqual(['a', 'b', 'c']);
    expect(results.filter((r) => !r.ok).map((r) => r.name)).toEqual(['b']);
    expect(notifier.notifyText).toHaveBeenCalledTimes(1);
    expect(notifier.notifyText.mock.calls[0][0]).toContain('b (exit 1): boom');
  });

  it('a thrown runner counts as a failed step, not a crash', async () => {
    const notifier = { notifyText: jest.fn() };
    const s = new DailyJobsScheduler(notifier as never);
    const results = await s.runAll([{ name: 'a', entry: 'x/a' }], () =>
      Promise.reject(new Error('spawn failed')),
    );
    expect(results[0].ok).toBe(false);
    expect(notifier.notifyText).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when every step passes', async () => {
    const notifier = { notifyText: jest.fn() };
    const s = new DailyJobsScheduler(notifier as never);
    await s.runAll([{ name: 'a', entry: 'x/a' }], (st) =>
      Promise.resolve(ok(st.name)),
    );
    expect(notifier.notifyText).not.toHaveBeenCalled();
  });
});

describe('toBroadcastRows (연대기 「방송」)', () => {
  it('maps title · broadcaster · date · link and drops link duplicates', () => {
    const rows = toBroadcastRows([
      {
        title: '도박 중독 다큐',
        source: 'KBS',
        sourceUrl: 'https://youtu.be/a',
        publishedAt: '2026-10-09T10:00:00Z',
      },
      { title: '같은 링크', source: 'KBS', sourceUrl: 'https://youtu.be/a' },
      { title: '링크 없음', source: 'MBC' },
      { title: '', sourceUrl: 'https://youtu.be/b' },
    ]);
    expect(rows).toEqual([
      {
        url: 'https://youtu.be/a',
        title: '도박 중독 다큐',
        broadcaster: 'KBS',
        publishedAt: new Date('2026-10-09T10:00:00Z'),
        grade: '방송',
      },
    ]);
  });

  it('returns nothing for an empty or malformed response', () => {
    expect(toBroadcastRows([])).toEqual([]);
    expect(toBroadcastRows({ data: [] })).toEqual([]);
  });
});
