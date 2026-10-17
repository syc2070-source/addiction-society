/**
 * 홈 재굽기 문지기 (SOC-R6 ■3 · SOC-R7 ■1) — /api/revalidate/home 이 쓴다.
 *
 * 공개 밤 기록(/api/health/nightly)의 lastRun(04:00 밤 회차) 또는 lastRefresh(00:05
 * 자정 재굽기) 중 하나라도 한 시간 안에 시작했을 때만 true. 비밀값 0.
 *
 * 의존 없음(시험: node --test src/lib/recentRun.test.mts).
 */

/** 예약 회차가 이만큼 안에 시작했을 때만 비운다(회차 하나 = 2분 안팎). */
export const RECENT_RUN_MS = 60 * 60 * 1000;

export type RunStart = { startedAt?: string | null } | null | undefined;

export function recentRun(
  body: { lastRun?: RunStart; lastRefresh?: RunStart } | null,
  now: number = Date.now(),
): boolean {
  return [body?.lastRun, body?.lastRefresh].some((r) => {
    const started = Date.parse(r?.startedAt ?? '');
    return Number.isFinite(started) && now - started <= RECENT_RUN_MS;
  });
}
