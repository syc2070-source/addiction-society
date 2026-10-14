/**
 * 「오늘의 숫자」 고르기 (SOC-R5 ■4) — 날마다 다른 지표, 그러나 같은 날엔 누구에게나 같은 지표.
 *
 * 후보 = 전체값 시계열이 2점 이상인 지표 전부(code 오름차순).
 * 오늘(KST) 날짜 수 = 1970-01-01 부터 센 날 수 → 날짜 수 % 후보 수 번째.
 * 무작위·접속 시각·사람 0 → 결정적(같은 날짜 = 같은 지표). 후보가 늘거나 줄면 순서가 바뀐다.
 *
 * 의존 없음(시험: node --test src/lib/todayNumber.test.mts).
 */

/** KST 기준 'YYYY-MM-DD'. */
export function kstDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 'YYYY-MM-DD' → 1970-01-01 부터 센 날 수. */
export function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 후보(2점 이상) 중 오늘의 하나와 그 자리. 후보가 없으면 null. */
export function pickTodaysNumber<T extends { code: string; points: number }>(
  candidates: T[],
  now: Date,
): { pick: T; index: number; total: number } | null {
  const pool = candidates
    .filter((c) => c.points >= 2)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  if (pool.length === 0) return null;
  const index = dayNumber(kstDate(now)) % pool.length;
  return { pick: pool[index], index, total: pool.length };
}
