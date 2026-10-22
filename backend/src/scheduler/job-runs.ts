import { Logger } from '@nestjs/common';
import { MoreThanOrEqual, type Repository } from 'typeorm';
import type { JobCounts } from '../common/job-counts';
import { JobRun } from './entities/job-run.entity';

/**
 * job_runs 쓰기·읽기 (SOC-R3 ■1).
 *
 * 쓰기(JobRunRecorder): 예약 러너가 회차 시작·단계·끝마다 한 행씩 넣는다. 기록 실패는
 * 예약을 멈추지 않는다(로그만) — 기록하려다 데이터 단계가 죽으면 안 된다.
 * 읽기(nightlySummary): GET /api/health/nightly 의 꼴. 숫자·시각·단계 이름만 —
 * error 꼬리(출력 원문)는 공개하지 않는다.
 */
export const RUN_START = 'run:start';
export const RUN_END = 'run:end';
export const RUN_SKIPPED = 'run';
/** 00:05 자정 홈 재굽기 회차의 시작·끝 (SOC-R7 ■1) — 밤 회차(lastRun·7일 수)와 섞이지 않게 따로. */
export const REFRESH_START = 'refresh:start';
export const REFRESH_END = 'refresh:end';

export type JobStatus = 'ok' | 'fail' | 'skipped';

export interface JobRunRow {
  runId: string;
  startedAt: Date;
  finishedAt: Date | null;
  step: string;
  status: JobStatus;
  counts: JobCounts | null;
  error: string | null;
}

export interface JobRunSink {
  insert(row: JobRunRow): Promise<unknown>;
}

export class JobRunRecorder {
  private readonly logger = new Logger('JobRunRecorder');

  constructor(private readonly sink: JobRunSink | null) {}

  async write(row: JobRunRow): Promise<void> {
    if (!this.sink) return;
    try {
      await this.sink.insert({
        ...row,
        error: row.error ? row.error.slice(-300) : null,
      });
    } catch (e: unknown) {
      this.logger.warn(`[daily] job_runs 기록 실패(무시): ${String(e)}`);
    }
  }
}

// ── 읽기 ──

export interface NightlyStep {
  step: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  seconds: number | null;
  counts: JobCounts | null;
}

export interface NightlyRun {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  /** ok | fail | running(끝 행 없음) | unfinished(끝 행 없이 뒤 회차가 섬 · runs[] 만) | skipped(건너뛴 회차 · 단계 없음) */
  status: string;
  steps: NightlyStep[];
  totals: JobCounts | null;
}

export interface NightlySummary {
  schedule: string;
  lastRun: NightlyRun | null;
  last7Days: { runs: number; failedRuns: number; skipped: number };
  /**
   * 최근 7일 밤 회차 전부(SOC-R11 ■2) — 새 회차가 앞. 마지막 회차만 단계표가 있어
   * 그 앞 회차가 「미측」이 되던 것을 없앤다. 자정 재굽기 회차는 들지 않는다.
   */
  runs: NightlyRun[];
  /** 마지막 00:05 자정 홈 재굽기(SOC-R7 ■1) — 없으면 null. */
  lastRefresh: {
    runId: string;
    startedAt: string;
    finishedAt: string | null;
    /** ok | fail | running(끝 행 없음) */
    status: string;
  } | null;
}

const iso = (d: Date | string | null) =>
  d == null ? null : new Date(d).toISOString();

/** 한 밤 회차의 행 → 시작·끝·단계표(시작 행이 없으면 null). */
function toRun(rows: JobRun[]): NightlyRun | null {
  const start = rows.find((r) => r.step === RUN_START);
  if (!start) return null;
  const end = rows.find((r) => r.step === RUN_END);
  const steps = rows
    .filter((r) => r.step !== RUN_START && r.step !== RUN_END)
    .sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt))
    .map(
      (r): NightlyStep => ({
        step: r.step,
        status: r.status,
        startedAt: iso(r.startedAt) as string,
        finishedAt: iso(r.finishedAt),
        seconds: r.finishedAt
          ? Math.round(
              (+new Date(r.finishedAt) - +new Date(r.startedAt)) / 1000,
            )
          : null,
        counts: r.counts ?? null,
      }),
    );
  return {
    runId: start.runId,
    startedAt: iso(start.startedAt) as string,
    finishedAt: iso(end?.finishedAt ?? null),
    status: end ? end.status : 'running',
    steps,
    totals: end?.counts ?? null,
  };
}

/** 7일 창의 행 → 밤 회차 목록(새 것이 앞). 건너뛴 회차는 status skipped 한 줄. */
function windowRuns(windowRows: JobRun[]): NightlyRun[] {
  const byRun = new Map<string, JobRun[]>();
  for (const r of windowRows) {
    const list = byRun.get(r.runId) ?? [];
    list.push(r);
    byRun.set(r.runId, list);
  }
  const runs: NightlyRun[] = [];
  for (const rows of byRun.values()) {
    const run = toRun(rows);
    if (run) {
      runs.push(run);
      continue;
    }
    const skip = rows.find(
      (r) => r.step === RUN_SKIPPED && r.status === 'skipped',
    );
    if (skip) {
      runs.push({
        runId: skip.runId,
        startedAt: iso(skip.startedAt) as string,
        finishedAt: iso(skip.finishedAt),
        status: 'skipped',
        steps: [],
        totals: null,
      });
    }
  }
  runs.sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  // 끝 행이 없는 회차가 맨 앞(가장 새 것)이 아니면 도는 중이 아니라 끊긴 것 — 7일 내내 running 으로 남지 않게
  return runs.map((r, i) =>
    i > 0 && r.status === 'running' ? { ...r, status: 'unfinished' } : r,
  );
}

export function summarizeNightly(
  lastRunRows: JobRun[],
  windowRows: JobRun[],
  lastRefreshRows: JobRun[] = [],
): NightlySummary {
  const refreshStart = lastRefreshRows.find((r) => r.step === REFRESH_START);
  const refreshEnd = lastRefreshRows.find((r) => r.step === REFRESH_END);
  return {
    schedule: '매일 04:00 KST',
    lastRun: toRun(lastRunRows),
    last7Days: {
      runs: windowRows.filter((r) => r.step === RUN_START).length,
      failedRuns: windowRows.filter(
        (r) => r.step === RUN_END && r.status === 'fail',
      ).length,
      skipped: windowRows.filter(
        (r) => r.step === RUN_SKIPPED && r.status === 'skipped',
      ).length,
    },
    runs: windowRuns(windowRows),
    lastRefresh: refreshStart
      ? {
          runId: refreshStart.runId,
          startedAt: iso(refreshStart.startedAt) as string,
          finishedAt: iso(refreshEnd?.finishedAt ?? null),
          status: refreshEnd ? refreshEnd.status : 'running',
        }
      : null,
  };
}

/** 그 시작 표식의 마지막 회차 행 전부(없으면 []). */
async function latestRunRows(
  repo: Repository<JobRun>,
  startStep: string,
): Promise<JobRun[]> {
  const latest = await repo.findOne({
    where: { step: startStep },
    order: { startedAt: 'DESC' },
  });
  return latest ? repo.find({ where: { runId: latest.runId } }) : [];
}

/** DB 에서 마지막 회차 행 + 최근 7일 행(단계표 포함 · 읽기만) + 마지막 자정 재굽기를 읽어 요약. */
export async function nightlySummary(
  repo: Repository<JobRun>,
  now: Date = new Date(),
): Promise<NightlySummary> {
  const lastRunRows = await latestRunRows(repo, RUN_START);
  const lastRefreshRows = await latestRunRows(repo, REFRESH_START);
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const windowRows = await repo.find({
    where: { startedAt: MoreThanOrEqual(since) },
    // runs[] 단계표까지 — error(출력 원문)는 읽지 않는다
    select: {
      step: true,
      status: true,
      runId: true,
      startedAt: true,
      finishedAt: true,
      counts: true,
    },
  });
  return summarizeNightly(lastRunRows, windowRows, lastRefreshRows);
}
