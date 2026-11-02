/**
 * 홈 v3 미리보기(견본 A) 규칙 — SOC-R20 ■2 · ■3. 결정론 · 저장된 값 그대로 · 모델 0 · 추정 0.
 *
 * 주인공 = 유형 여섯 대표 지표 가운데 |마지막 값 − 첫 값| / 첫 값 이 가장 큰 유형.
 *   설계 단절이 있는 계열은 후보에서 뺀다(단절 앞뒤를 비교하지 않는 원칙 · seriesBreaks 와 같은 판정).
 *   점이 둘 미만 · 첫 값이 0 · 읽을 수 없는 값은 후보 아님. 같은 점수면 유형 순서(ADDICTION_TYPES) 앞.
 * 「n배」 = 발표 값 둘(마지막 ÷ 첫)의 나눗셈 · 소수 1자리.
 */
import { seriesBreakYears } from './seriesBreaks.ts';
import type { Point } from './homeV2.ts';

export interface HeroCandidate<T extends string = string> {
  type: T;
  code: string;
  series: Point[];
  breakYears: number[] | null;
}

export interface HeroRow<T extends string = string> {
  type: T;
  code: string;
  first: Point | null;
  last: Point | null;
  /** |마지막 − 첫| / 첫 — 후보가 아니면 null */
  score: number | null;
  /** 후보에서 뺀 까닭 */
  excluded: 'break' | 'points' | 'zero' | null;
}

export function heroRows<T extends string>(cands: HeroCandidate<T>[]): HeroRow<T>[] {
  return cands.map((c) => {
    const first = c.series[0] ?? null;
    const last = c.series[c.series.length - 1] ?? null;
    const base = { type: c.type, code: c.code, first, last };
    if (c.series.length < 2 || !first || !last) {
      return { ...base, score: null, excluded: 'points' as const };
    }
    const breaks = seriesBreakYears(
      c.series.map((p) => p.period),
      c.breakYears,
    );
    if (breaks.length > 0) return { ...base, score: null, excluded: 'break' as const };
    const a = Number(first.value);
    const b = Number(last.value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) {
      return { ...base, score: null, excluded: 'zero' as const };
    }
    return { ...base, score: Math.abs(b - a) / a, excluded: null };
  });
}

/** 주인공 하나(없으면 null). 같은 점수면 들어온 순서 앞. */
export function pickHero<T extends string>(cands: HeroCandidate<T>[]): HeroRow<T> | null {
  let best: HeroRow<T> | null = null;
  for (const r of heroRows(cands)) {
    if (r.score === null) continue;
    if (!best || r.score > (best.score ?? -1)) best = r;
  }
  return best;
}

/** 「n배」 — 마지막 ÷ 첫 · 소수 1자리(첫 값 0 이면 null) */
export function ratioText(first: string, last: string): string | null {
  const a = Number(first);
  const b = Number(last);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b / a).toFixed(1);
}

/** 가장 큰 값의 자리(같으면 앞) — 값이 없으면 -1 */
export function maxIndex(values: number[]): number {
  let k = -1;
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i]) && (k < 0 || values[i] > values[k])) k = i;
  }
  return k;
}
