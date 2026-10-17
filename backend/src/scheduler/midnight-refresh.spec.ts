import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DAILY_STEPS,
  DailyJobsScheduler,
  MIDNIGHT_STEPS,
  StepResult,
} from './daily-jobs.scheduler';
import { JobRun } from './entities/job-run.entity';
import {
  REFRESH_END,
  REFRESH_START,
  RUN_END,
  RUN_START,
  summarizeNightly,
} from './job-runs';

/** SOC-R7 ■1 — 00:05 KST 자정 홈 재굽기(refresh:home 재사용 · 04:00 아홉 단계 그대로). */
describe('자정 홈 재굽기 (SOC-R7 ■1)', () => {
  const ok = (name: string): StepResult => ({
    name,
    ok: true,
    code: 0,
    ms: 1,
    tail: '',
    counts: { inserted: 0, updated: 0, skipped: 0, diff: 0 },
  });

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
    return { s, rows, notifier };
  }

  it('00:05 KST cron runs only refresh:home; the 04:00 nine steps stay as they are', () => {
    expect(MIDNIGHT_STEPS).toEqual([
      { name: 'refresh:home', entry: 'scheduler/refresh-home' },
    ]);
    expect(DAILY_STEPS).toHaveLength(9);
    expect(DAILY_STEPS[DAILY_STEPS.length - 1].name).toBe('refresh:home');

    const src = readFileSync(
      join(__dirname, 'daily-jobs.scheduler.ts'),
      'utf8',
    );
    expect(src).toContain(
      "@Cron('5 0 * * *', { name: 'midnightHomeRefresh', timeZone: 'Asia/Seoul' })",
    );
    expect(src).toContain(
      "@Cron('0 4 * * *', { name: 'dailyDataJobs', timeZone: 'Asia/Seoul' })",
    );
  });

  it('handleMidnight records a refresh run (refresh:start → refresh:home → refresh:end, counts 0), never run:start', async () => {
    const { s, rows, notifier } = setup();
    const ran: string[] = [];
    jest.spyOn(s, 'runStep').mockImplementation((st) => {
      ran.push(st.name);
      return Promise.resolve(ok(st.name));
    });
    await s.handleMidnight();
    expect(ran).toEqual(['refresh:home']);
    expect(rows.map((r) => r.step)).toEqual([
      REFRESH_START,
      'refresh:home',
      REFRESH_END,
    ]);
    expect(rows.some((r) => r.step === RUN_START || r.step === RUN_END)).toBe(
      false,
    );
    expect(rows[2].counts).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 0,
      diff: 0,
    });
    expect(notifier.notifyText).not.toHaveBeenCalled();
  });

  it('a refused revalidate (409 → exit 1) ends the refresh run as fail and alerts under its own name', async () => {
    const { s, rows, notifier } = setup();
    await s.runAll(
      MIDNIGHT_STEPS,
      (st) =>
        Promise.resolve({
          name: st.name,
          ok: false,
          code: 1,
          ms: 1,
          tail: '[refresh:home] {"revalidated":false,"failed":["revalidate 409"]}',
        }),
      'refresh',
    );
    expect(rows.find((r) => r.step === REFRESH_END)?.status).toBe('fail');
    const msg = (notifier.notifyText.mock.calls as string[][])[0][0];
    expect(msg).toContain('자정 홈 재굽기 실패 1/1');
    expect(msg).toContain('revalidate 409');
  });

  describe('/api/health/nightly lastRefresh', () => {
    const t = (s: string) => new Date(`2026-10-18T${s}+09:00`);
    const row = (p: Partial<JobRun>): JobRun =>
      ({
        id: 1,
        runId: 'n1',
        startedAt: t('04:00:00'),
        finishedAt: null,
        step: RUN_START,
        status: 'ok',
        counts: null,
        error: null,
        createdAt: t('04:00:00'),
        ...p,
      }) as JobRun;
    const nightly = [
      row({ startedAt: new Date('2026-10-17T04:00:00+09:00') }),
      row({
        step: RUN_END,
        startedAt: new Date('2026-10-17T04:00:00+09:00'),
        finishedAt: new Date('2026-10-17T04:01:30+09:00'),
      }),
    ];
    const refresh = [
      row({ runId: 'm1', step: REFRESH_START, startedAt: t('00:05:00') }),
      row({
        runId: 'm1',
        step: 'refresh:home',
        startedAt: t('00:05:00'),
        finishedAt: t('00:05:07'),
        counts: { inserted: 0, updated: 0, skipped: 0, diff: 0 },
      }),
      row({
        runId: 'm1',
        step: REFRESH_END,
        startedAt: t('00:05:00'),
        finishedAt: t('00:05:07'),
      }),
    ];

    it('shows the 00:05 run in its own field; lastRun and 7-day counts stay the 04:00 nightly', () => {
      const s = summarizeNightly(nightly, [...nightly, ...refresh], refresh);
      expect(s.lastRun?.runId).toBe('n1');
      expect(s.last7Days).toEqual({ runs: 1, failedRuns: 0, skipped: 0 });
      expect(s.lastRefresh).toEqual({
        runId: 'm1',
        startedAt: t('00:05:00').toISOString(),
        finishedAt: t('00:05:07').toISOString(),
        status: 'ok',
      });
    });

    it('a refresh without its end reads as running (the site gate sees it started); none → null', () => {
      expect(
        summarizeNightly(nightly, nightly, [refresh[0]]).lastRefresh?.status,
      ).toBe('running');
      expect(summarizeNightly(nightly, nightly).lastRefresh).toBeNull();
    });
  });

  it('the site gate opens for lastRun or lastRefresh within the hour, else 409 (no secret)', () => {
    const site = join(__dirname, '..', '..', '..', 'frontend-next', 'src');
    const route = readFileSync(
      join(site, 'app', 'api', 'revalidate', 'home', 'route.ts'),
      'utf8',
    );
    const gate = readFileSync(join(site, 'lib', 'recentRun.ts'), 'utf8');
    expect(route).toContain('recentRun(body)');
    expect(route).toContain('status: 409');
    expect(route).not.toMatch(/process\.env\.(?!NEXT_PUBLIC_API_URL)/);
    expect(gate).toContain('[body?.lastRun, body?.lastRefresh]');
    expect(gate).toContain('60 * 60 * 1000');
  });
});
