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

export interface NightlySummary {
  schedule: string;
  lastRun: {
    runId: string;
    startedAt: string;
    finishedAt: string | null;
    /** ok | fail | running(끝 행 없음) */
    status: string;
    steps: NightlyStep[];
    totals: JobCounts | null;
  } | null;
  last7Days: { runs: number; failedRuns: number; skipped: number };
}

const iso = (d: Date | string | null) =>
  d == null ? null : new Date(d).toISOString();

export function summarizeNightly(
  lastRunRows: JobRun[],
  windowRows: JobRun[],
): NightlySummary {
  const start = lastRunRows.find((r) => r.step === RUN_START);
  const end = lastRunRows.find((r) => r.step === RUN_END);
  const steps = lastRunRows
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
    schedule: '매일 04:00 KST',
    lastRun: start
      ? {
          runId: start.runId,
          startedAt: iso(start.startedAt) as string,
          finishedAt: iso(end?.finishedAt ?? null),
          status: end ? end.status : 'running',
          steps,
          totals: end?.counts ?? null,
        }
      : null,
    last7Days: {
      runs: windowRows.filter((r) => r.step === RUN_START).length,
      failedRuns: windowRows.filter(
        (r) => r.step === RUN_END && r.status === 'fail',
      ).length,
      skipped: windowRows.filter(
        (r) => r.step === RUN_SKIPPED && r.status === 'skipped',
      ).length,
    },
  };
}

/** DB 에서 마지막 회차 행 + 최근 7일 시작·끝 행을 읽어 요약. */
export async function nightlySummary(
  repo: Repository<JobRun>,
  now: Date = new Date(),
): Promise<NightlySummary> {
  const latest = await repo.findOne({
    where: { step: RUN_START },
    order: { startedAt: 'DESC' },
  });
  const lastRunRows = latest
    ? await repo.find({ where: { runId: latest.runId } })
    : [];
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const windowRows = await repo.find({
    where: { startedAt: MoreThanOrEqual(since) },
    select: { step: true, status: true, runId: true, startedAt: true },
  });
  return summarizeNightly(lastRunRows, windowRows);
}
