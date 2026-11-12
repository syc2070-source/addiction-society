/**
 * 정책 쪽 ⑥ 「연구는 무엇을 말하나」의 주제 둘 (SOC-R24 ■3 · 결정 4) — 근거 카드에서 낱말 규칙으로 고른다.
 * 모델 판정 0 · 카드 글 바꿈 0. 보는 글 = 제목 + 서재 요약(findings_ko) — 근거 쪽 하위 주제(evidencePages)와 같은 잣대.
 * 카드 0 인 주제는 칸 · 쪽을 만들지 않는다.
 *
 * 의존 없음(시험: policyThemes.test.mts).
 */
import type { EvidenceCard } from './statoryEvidence.ts';

export const THEMES = ['case-management', 'prevention-program'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_RULES: Record<Theme, RegExp> = {
  // 사례관리 · 통합사례관리 · case management / case-managed
  'case-management': /사례\s*관리|\bcase[\s-]*manag/i,
  // 예방 프로그램 · 예방교육 · 예방 중재 · prevention program(me)/intervention/curriculum · school/family/community-based prevention
  //  — 재발 · 자살 · 감염/전파 예방은 뺀다(R24 리뷰: 치료 · 다른 주제의 「예방」)
  'prevention-program':
    /(?<!(재발|자살|전파|감염|확산)\s*)예방\s*(프로그램|교육|중재)|(?<!(relapse|suicide|infection|transmission|hiv|hcv)[\s-]*)\bprevention\s*(program|intervention|curricul)|\b(school|family|community)[\s-]*based\s*prevention|학교\s*기반\s*예방/i,
};

export const isTheme = (v: string): v is Theme => (THEMES as readonly string[]).includes(v);

const textOf = (c: Pick<EvidenceCard, 'title' | 'findings_ko'>) =>
  [c.title, c.findings_ko].filter(Boolean).join('\n');

/** 주제에 걸리는 카드(넘겨받은 순서 그대로) */
export function cardsOfTheme<C extends Pick<EvidenceCard, 'title' | 'findings_ko'>>(cards: C[], theme: Theme): C[] {
  return cards.filter((c) => THEME_RULES[theme].test(textOf(c)));
}

/** 카드가 있는 주제와 수(THEMES 순서 · 0 인 주제는 뺀다) */
export function themeCounts(cards: Array<Pick<EvidenceCard, 'title' | 'findings_ko'>>): Array<{ theme: Theme; n: number }> {
  return THEMES.map((theme) => ({ theme, n: cardsOfTheme(cards, theme).length })).filter((x) => x.n > 0);
}
