/**
 * 조사 설계 변경 해에서 추세선 끊기 (SOC-R6 ■2) — 값은 그대로, 선만 나눈다.
 *
 * breakYears 의 해 Y 는 「Y 의 관측치를 앞 해와 직접 비교하지 않는다」는 뜻(지표 메타
 * indicators.break_years). 기간 오름차순 시계열에서 앞 점의 해 < Y ≤ 이 점의 해 이면
 * 이 점에서 새 토막이 시작된다. 토막 안은 실선, 토막 사이는 점선으로 잇는다.
 *
 * 의존 없음(시험: node --test src/lib/seriesBreaks.test.mts).
 */

/** 기간('2023' · '2023-06' · '2023Q2' …) → 해. 못 읽으면 NaN. */
export function periodYear(period: string): number {
  const m = /^(\d{4})/.exec(period.trim());
  return m ? Number(m[1]) : NaN;
}

/** 시계열 안에서 실제로 선을 끊는 해만(첫 점 앞·마지막 점 뒤의 해는 빼고), 오름차순·중복 없이. */
export function seriesBreakYears(
  periods: string[],
  breakYears: number[] | null | undefined,
): number[] {
  if (!breakYears?.length || periods.length < 2) return [];
  const years = periods.map(periodYear);
  const out = new Set<number>();
  for (let i = 1; i < years.length; i++) {
    for (const y of breakYears) {
      if (years[i - 1] < y && y <= years[i]) out.add(y);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** 점 번호 토막들. 끊는 해가 없으면 [[0..n-1]] 하나. */
export function splitAtBreaks(
  periods: string[],
  breakYears: number[] | null | undefined,
): number[][] {
  if (periods.length === 0) return [];
  const years = periods.map(periodYear);
  const segs: number[][] = [[0]];
  for (let i = 1; i < years.length; i++) {
    const cut = (breakYears ?? []).some(
      (y) => years[i - 1] < y && y <= years[i],
    );
    if (cut) segs.push([i]);
    else segs[segs.length - 1].push(i);
  }
  return segs;
}
