/**
 * 매일 예약 단계의 수 (SOC-R3 ■1).
 *
 * 단계 스크립트는 자식 프로세스라 값을 돌려줄 길이 출력뿐이다. 끝에 한 줄
 *   [job_counts] {"inserted":3,"updated":0,"skipped":70,"diff":1}
 * 을 찍으면 예약 러너가 그 줄을 읽어 job_runs.counts 에 넣는다.
 * diff = seed_diff 수(넣기만 seed 가 기존 행과 다른 값을 본 횟수 — 덮지 않음).
 */
export interface JobCounts {
  inserted: number;
  updated: number;
  skipped: number;
  diff: number;
}

export const JOB_COUNTS_TAG = '[job_counts]';

const KEYS: (keyof JobCounts)[] = ['inserted', 'updated', 'skipped', 'diff'];

function toCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function jobCounts(c: Partial<JobCounts> = {}): JobCounts {
  return {
    inserted: toCount(c.inserted),
    updated: toCount(c.updated),
    skipped: toCount(c.skipped),
    diff: toCount(c.diff),
  };
}

export function jobCountsLine(c: Partial<JobCounts>): string {
  return `${JOB_COUNTS_TAG} ${JSON.stringify(jobCounts(c))}`;
}

export function printJobCounts(c: Partial<JobCounts>): void {
  console.log(jobCountsLine(c));
}

/** 출력 한 줄이 job_counts 줄이면 수를, 아니면 null. */
export function parseJobCountsLine(line: string): JobCounts | null {
  const i = line.indexOf(JOB_COUNTS_TAG);
  if (i < 0) return null;
  try {
    const o = JSON.parse(
      line.slice(i + JOB_COUNTS_TAG.length).trim(),
    ) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return null;
    return jobCounts(o as Partial<JobCounts>);
  } catch {
    return null;
  }
}

/** 여러 단계의 수를 더한다(run:end 행). */
export function sumJobCounts(list: (JobCounts | null)[]): JobCounts {
  const total = jobCounts();
  for (const c of list) {
    if (!c) continue;
    for (const k of KEYS) total[k] += c[k];
  }
  return total;
}
