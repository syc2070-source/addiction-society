/**
 * 홈 v4 미리보기 규칙 — SOC-R21 ■2 「서재 규모」 한 줄. 저장된 수의 덧셈만 · 추정 0 · 모델 0.
 *
 * 근거 지도 주제 묶음(지금 청소년 도박 · 알코올 회복 둘)의 studies · open_access · trend.last_five_years 를 더한다.
 * 한 칸이라도 비어 있는 주제가 있으면 그 칸의 합은 내지 않는다(null → 줄 전체를 그리지 않음) — 모자란 합을 합계로 보이지 않게.
 * 두 주제에 함께 든 논문은 두 번 셀 수 있다(묶음에 논문 id 목록이 없어 겹침을 뺄 수 없음) — 화면 꼬리말에 적는다.
 */

export interface ScaleInput {
  studies: number;
  openAccess: number | null;
  trend: { lastFive: number } | null;
}

export interface LibraryScale {
  topics: number;
  studies: number;
  openAccess: number;
  lastFive: number;
}

export function libraryScale(maps: Array<ScaleInput | null>): LibraryScale | null {
  const ok = maps.filter((m): m is ScaleInput => m !== null);
  if (ok.length === 0 || ok.length !== maps.length) return null;
  if (ok.some((m) => m.openAccess === null || m.trend === null)) return null;
  return {
    topics: ok.length,
    studies: ok.reduce((s, m) => s + m.studies, 0),
    openAccess: ok.reduce((s, m) => s + (m.openAccess ?? 0), 0),
    lastFive: ok.reduce((s, m) => s + (m.trend?.lastFive ?? 0), 0),
  };
}
