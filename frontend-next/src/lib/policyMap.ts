/**
 * 정책 쪽 칸 문턱 · 셈 (SOC-R24 결정 7 · 3③).
 *  - 칸이 서는가: 원자료에서 확인해 실은 항목 수 × 2 ≥ 강연 자료가 든 항목 수(절반 미만이면 칸 0 · 「준비 중」 0).
 *  - 쪽이 열리는가: 일곱 칸 가운데 넷 이상이 서면.
 *  - 연표의 영역별 수(「어디에 몰려 있나」는 센 수로만 말한다).
 * 의존 없음(시험: policyMap.test.mts).
 */
import {
  COUNTRIES,
  COUNTRIES_CLAIMED,
  FIGURES,
  FIGURES_CLAIMED,
  GAPS,
  GAPS_CLAIMED,
  LAYERS,
  LAYERS_CLAIMED,
  LOCAL,
  LOCAL_CLAIMED,
  MORE_FIGURES,
  RESEARCH,
  RESEARCH_CLAIMED,
  SOURCES,
  TIMELINE,
  TIMELINE_CLAIMED,
  type Area,
} from '../data/policy-map.ts';

export const SECTIONS = ['size', 'who', 'changes', 'gaps', 'abroad', 'research', 'local'] as const;
export type SectionKey = (typeof SECTIONS)[number];

export const stands = (shown: number, claimed: number) => claimed > 0 && shown * 2 >= claimed;

/** 칸마다 (실은 수 · 든 수) */
export function sectionTally(): Record<SectionKey, { shown: number; claimed: number }> {
  const cells = LAYERS.flatMap((r) => Object.values(r.cells));
  return {
    size: { shown: FIGURES.length + MORE_FIGURES.length, claimed: FIGURES_CLAIMED },
    who: { shown: cells.filter((c) => c !== null).length, claimed: LAYERS_CLAIMED },
    changes: { shown: TIMELINE.length, claimed: TIMELINE_CLAIMED },
    gaps: { shown: GAPS.filter((g) => g.value !== null).length, claimed: GAPS_CLAIMED },
    abroad: { shown: COUNTRIES.length, claimed: COUNTRIES_CLAIMED },
    research: { shown: RESEARCH.length, claimed: RESEARCH_CLAIMED },
    local: { shown: LOCAL.filter((g) => g.value !== null).length, claimed: LOCAL_CLAIMED },
  };
}

export function standingSections(): SectionKey[] {
  const t = sectionTally();
  return SECTIONS.filter((k) => stands(t[k].shown, t[k].claimed));
}

/** 일곱 가운데 넷 이상 → 쪽을 연다(색인 · 차림표 · 사이트맵). 셋 이하 → 미리보기 길만. */
export const pageOpens = (standing: readonly SectionKey[]) => standing.length >= 4;

/** 연표 영역별 수(많은 차례 · 같으면 영역 이름 차례) */
export function timelineAreaCounts(items: Array<{ area: Area }> = TIMELINE): Array<{ area: Area; n: number }> {
  const n = new Map<Area, number>();
  for (const it of items) n.set(it.area, (n.get(it.area) ?? 0) + 1);
  return [...n.entries()]
    .map(([area, k]) => ({ area, n: k }))
    .sort((a, b) => b.n - a.n || a.area.localeCompare(b.area));
}

/** 실린 값이 가리키는 모든 출처 id(없는 id 를 잡는 시험용) */
export function usedSourceIds(): string[] {
  const all = [
    ...FIGURES,
    ...MORE_FIGURES,
    ...LAYERS.flatMap((r) => Object.values(r.cells).filter((c) => c !== null)),
    ...TIMELINE,
    ...GAPS,
    ...COUNTRIES,
    ...RESEARCH,
    ...LOCAL,
  ].flatMap((x) => x!.src as string[]);
  return [...new Set(all)];
}

export const hasSource = (id: string) => Object.prototype.hasOwnProperty.call(SOURCES, id);
