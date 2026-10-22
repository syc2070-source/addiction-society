import { DailyJobsScheduler, StepResult } from './daily-jobs.scheduler';
import { JobRun } from './entities/job-run.entity';
import { summarizeNightly, RUN_END, RUN_START } from './job-runs';
import {
  jobCountsLine,
  parseJobCountsLine,
  sumJobCounts,
} from '../common/job-counts';
import { HealthController } from '../health.controller';

// SOC-R3 ■1 — 매일 예약 기록(job_runs) + GET /api/health/nightly.
const steps = [
  { name: 'seed:sources', entry: 'x/a' },
  { name: 'collect:indicators', entry: 'x/b' },
  { name: 'collect:broadcasts', entry: 'x/c' },
];

function setup() {
  const rows: Record<string, unknown>[] = [];
  const notifier = { notifyText: jest.fn() };
  const repo = {
    insert: jest.fn((row: Record<string, unknown>) => {
      rows.push(row);
      return Promise.resolve();
    }),
  };
  const s = new DailyJobsScheduler(notifier as never, repo as never);
  return { s, rows, notifier, repo };
}

const ok = (name: string, counts: StepResult['counts'] = null): StepResult => ({
  name,
  ok: true,
  code: 0,
  ms: 5,
  tail: '',
  counts,
});

describe('job_runs 기록', () => {
  it('writes run:start, one row per step and run:end with summed counts', async () => {
    const { s, rows } = setup();
    await s.runAll(steps, (st) =>
      Promise.resolve(
        ok(
          st.name,
          st.name === 'collect:broadcasts'
            ? null
            : { inserted: 2, updated: 0, skipped: 5, diff: 1 },
        ),
      ),
    );
    expect(rows.map((r) => r.step)).toEqual([
      RUN_START,
      'seed:sources',
      'collect:indicators',
      'collect:broadcasts',
      RUN_END,
    ]);
    expect(new Set(rows.map((r) => r.runId)).size).toBe(1);
    expect(rows.every((r) => r.status === 'ok')).toBe(true);
    expect(rows[1].counts).toEqual({
      inserted: 2,
      updated: 0,
      skipped: 5,
      diff: 1,
    });
    expect(rows[3].counts).toBeNull();
    expect(rows[4].counts).toEqual({
      inserted: 4,
      updated: 0,
      skipped: 10,
      diff: 2,
    });
  });

  it('records a failed step (error ≤ 300) and run:end fail, Discord ends with the nightly address', async () => {
    const { s, rows, notifier } = setup();
    await s.runAll(steps, (st) =>
      Promise.resolve(
        st.name === 'collect:indicators'
          ? {
              name: st.name,
              ok: false,
              code: 1,
              ms: 1,
              tail: `${'x'.repeat(500)} MigrationInterface`,
            }
          : ok(st.name),
      ),
    );
    const failed = rows.find((r) => r.step === 'collect:indicators');
    expect(failed?.status).toBe('fail');
    expect(String(failed?.error).length).toBeLessThanOrEqual(300);
    expect(String(failed?.error)).toContain('MigrationInterface');
    // 실패 뒤에도 다음 단계는 그대로 돈다(규칙 그대로)
    expect(rows.find((r) => r.step === 'collect:broadcasts')?.status).toBe(
      'ok',
    );
    const end = rows.find((r) => r.step === RUN_END);
    expect(end?.status).toBe('fail');
    const msg = (notifier.notifyText.mock.calls as string[][])[0][0];
    expect(msg.split('\n').pop()).toMatch(/\/api\/health\/nightly$/);
  });

  it('a broken job_runs table never stops the steps', async () => {
    const notifier = { notifyText: jest.fn() };
    const repo = { insert: jest.fn(() => Promise.reject(new Error('42P01'))) };
    const s = new DailyJobsScheduler(notifier as never, repo as never);
    const ran: string[] = [];
    const results = await s.runAll(steps, (st) => {
      ran.push(st.name);
      return Promise.resolve(ok(st.name));
    });
    expect(ran).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
  });
});

describe('[job_counts] 줄', () => {
  it('round-trips and ignores other lines', () => {
    const line = jobCountsLine({ inserted: 3, diff: 1 });
    expect(line).toBe(
      '[job_counts] {"inserted":3,"updated":0,"skipped":0,"diff":1}',
    );
    expect(parseJobCountsLine(line)).toEqual({
      inserted: 3,
      updated: 0,
      skipped: 0,
      diff: 1,
    });
    expect(parseJobCountsLine('[seed_diff] sources: 신규 0')).toBeNull();
    expect(parseJobCountsLine('[job_counts] {broken')).toBeNull();
    expect(
      sumJobCounts([null, { inserted: 1, updated: 2, skipped: 3, diff: 4 }]),
    ).toEqual({
      inserted: 1,
      updated: 2,
      skipped: 3,
      diff: 4,
    });
  });
});

describe('GET /api/health/nightly 꼴', () => {
  const t = (s: string) => new Date(`2026-10-14T${s}+09:00`);
  const row = (p: Partial<JobRun>): JobRun =>
    ({
      id: 1,
      runId: 'r1',
      startedAt: t('04:00:00'),
      finishedAt: null,
      step: RUN_START,
      status: 'ok',
      counts: null,
      error: null,
      createdAt: t('04:00:00'),
      ...p,
    }) as JobRun;

  const lastRun = [
    row({}),
    row({
      step: 'seed:sources',
      startedAt: t('04:00:01'),
      finishedAt: t('04:00:11'),
      counts: { inserted: 0, updated: 0, skipped: 32, diff: 0 },
    }),
    row({
      step: 'collect:research',
      status: 'fail',
      startedAt: t('04:01:00'),
      finishedAt: t('04:01:30'),
      error: 'exit 1: connect ECONNREFUSED owner@example.com',
    }),
    row({
      step: RUN_END,
      status: 'fail',
      finishedAt: t('04:02:00'),
      counts: { inserted: 0, updated: 0, skipped: 32, diff: 0 },
      error: 'collect:research',
    }),
  ];

  it('shows the last run with its step table and 7-day counts', () => {
    const s = summarizeNightly(lastRun, [
      ...lastRun,
      row({ runId: 'r0', startedAt: t('03:00:00') }),
      row({ runId: 'r0', step: RUN_END, status: 'ok' }),
      row({ runId: 'r9', step: 'run', status: 'skipped' }),
    ]);
    expect(s.lastRun?.runId).toBe('r1');
    expect(s.lastRun?.status).toBe('fail');
    expect(s.lastRun?.steps.map((x) => [x.step, x.status, x.seconds])).toEqual([
      ['seed:sources', 'ok', 10],
      ['collect:research', 'fail', 30],
    ]);
    expect(s.lastRun?.totals?.skipped).toBe(32);
    expect(s.last7Days).toEqual({ runs: 2, failedRuns: 1, skipped: 1 });
  });

  it('SOC-R11: runs[] keeps every run of the 7 days with its step table, newest first', () => {
    const r0 = (s: string) => new Date(`2026-10-13T${s}+09:00`);
    const s = summarizeNightly(lastRun, [
      ...lastRun,
      row({ runId: 'r0', startedAt: r0('04:00:00') }),
      row({
        runId: 'r0',
        step: 'seed:sources',
        startedAt: r0('04:00:01'),
        finishedAt: r0('04:00:03'),
        counts: { inserted: 0, updated: 0, skipped: 24, diff: 0 },
      }),
      row({
        runId: 'r0',
        step: RUN_END,
        startedAt: r0('04:00:00'),
        finishedAt: r0('04:00:04'),
        counts: { inserted: 0, updated: 0, skipped: 24, diff: 0 },
      }),
      row({
        runId: 'r9',
        step: 'run',
        status: 'skipped',
        startedAt: r0('03:00:00'),
      }),
      // 자정 재굽기 회차는 밤 회차 목록에 들지 않는다
      row({ runId: 'rf', step: 'refresh:start', startedAt: t('00:05:00') }),
      row({ runId: 'rf', step: 'refresh:end', startedAt: t('00:05:00') }),
    ]);
    expect(s.runs.map((r) => [r.runId, r.status, r.steps.length])).toEqual([
      ['r1', 'fail', 2],
      ['r0', 'ok', 1],
      ['r9', 'skipped', 0],
    ]);
    expect(s.runs[1].steps[0]).toMatchObject({
      step: 'seed:sources',
      seconds: 2,
      counts: { diff: 0, skipped: 24 },
    });
    expect(s.runs[1].totals?.skipped).toBe(24);
    expect(s.runs[0]).toEqual(s.lastRun);
    expect(JSON.stringify(s.runs)).not.toContain('ECONNREFUSED');
  });

  it('SOC-R11 review: a run with no run:end before a newer run reads unfinished, the newest still running', () => {
    const d = (day: string) => new Date(`2026-10-${day}T04:00:00+09:00`);
    const s = summarizeNightly(
      [row({ runId: 'new', startedAt: d('14') })],
      [
        row({ runId: 'new', startedAt: d('14') }),
        row({ runId: 'dead', startedAt: d('12') }),
      ],
    );
    expect(s.runs.map((r) => [r.runId, r.status])).toEqual([
      ['new', 'running'],
      ['dead', 'unfinished'],
    ]);
    expect(s.lastRun?.status).toBe('running');
  });

  it('carries no error text or personal fields', () => {
    const body = JSON.stringify(summarizeNightly(lastRun, lastRun));
    expect(body).not.toContain('error');
    expect(body).not.toContain('@');
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toMatch(/email|reviewed_?by|user/i);
  });

  it('a run without run:end reads as running; no runs → lastRun null', () => {
    expect(summarizeNightly([lastRun[0]], []).lastRun?.status).toBe('running');
    expect(summarizeNightly([], []).lastRun).toBeNull();
  });

  it('the endpoint answers 503 before the database is ready', async () => {
    const c = new HealthController(undefined);
    await expect(c.nightly()).rejects.toMatchObject({ status: 503 });
  });
});
