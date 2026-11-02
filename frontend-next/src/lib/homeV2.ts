/**
 * 홈 v2 「한 그림 먼저」 계산 (SOC-R19 ■1) — 저장된 값을 그대로 쓰고, 화면용 두 가지만 만든다.
 *
 *  1. 앞 조사 대비 변화(큰 수 아래) = 마지막 값 − 바로 앞 값. 두 값의 소수 자리 중 큰 쪽으로 끊는다
 *     (부동소수 꼬리 0). 두 점 사이에 조사 설계 변경 해가 있으면 비교하지 않는다(null · 까닭 'break').
 *  2. 지수(첫 해 = 100) = 값 ÷ 그 시계열 첫 값 × 100 — 그림 토글에서만 · 저장 0 · 숫자 칸에는 쓰지 않는다.
 *
 * 추정 · 보간 0. 의존 없음(시험: homeV2.test.mts).
 */
import { periodYear, seriesBreakYears } from './seriesBreaks.ts';

export interface Point {
  period: string;
  value: string;
}

const decimals = (v: string) => {
  const m = /\.(\d+)$/.exec(v.trim());
  return m ? m[1].length : 0;
};

export type Change =
  | { kind: 'delta'; text: string; sign: 1 | -1 | 0; fromPeriod: string }
  | { kind: 'break'; fromPeriod: string }
  | { kind: 'none' };

/** 마지막 점과 바로 앞 점의 차이(글자) · 끊김이면 비교 안 함. */
export function changeFromPrevious(
  series: Point[],
  breakYears: number[] | null | undefined,
): Change {
  if (series.length < 2) return { kind: 'none' };
  const prev = series[series.length - 2];
  const last = series[series.length - 1];
  if (seriesBreakYears([prev.period, last.period], breakYears).length > 0) {
    return { kind: 'break', fromPeriod: prev.period };
  }
  const a = Number(last.value);
  const b = Number(prev.value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { kind: 'none' };
  const d = Math.max(decimals(last.value), decimals(prev.value));
  const diff = Number((a - b).toFixed(d));
  const sign: 1 | -1 | 0 = diff > 0 ? 1 : diff < 0 ? -1 : 0;
  const abs = Math.abs(diff).toFixed(d);
  return {
    kind: 'delta',
    text: sign === 0 ? abs : `${sign > 0 ? '+' : '−'}${abs}`,
    sign,
    fromPeriod: prev.period,
  };
}

/** 지수(첫 값 = 100). 첫 값이 0 이거나 못 읽으면 null(그 그림은 지수 보기에서 빠진다). */
export function indexSeries(series: Point[]): number[] | null {
  if (series.length === 0) return null;
  const base = Number(series[0].value);
  if (!Number.isFinite(base) || base === 0) return null;
  return series.map((p) => (Number(p.value) / base) * 100);
}

/** 오늘의 숫자에서 시작해 이어지는 셋(후보 순서 그대로 · 같은 날 = 같은 셋). */
export function threeFrom<T>(pool: T[], start: number): T[] {
  if (pool.length === 0) return [];
  const n = Math.min(3, pool.length);
  return Array.from({ length: n }, (_, k) => pool[(start + k) % pool.length]);
}

/** 그림의 해 범위(모든 시계열의 첫 해 ~ 끝 해). */
export function yearDomain(all: Point[][]): [number, number] | null {
  const ys = all.flat().map((p) => periodYear(p.period)).filter(Number.isFinite);
  if (ys.length === 0) return null;
  return [Math.min(...ys), Math.max(...ys)];
}
