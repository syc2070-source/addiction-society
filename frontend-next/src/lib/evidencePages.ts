/**
 * 근거 쪽 나눔 (SOC-R23 ■2 · 결정 15) — /evidence/<유형> 을 한 쪽 40장 · 하위 주제로 거르기.
 *
 *  나눔: 한 유형의 카드가 100장을 넘을 때만(SPLIT_OVER) · 넘지 않으면 지금처럼 한 쪽에 전부(거르기 0).
 *  주소(모두 빌드 때 정적 · 쿼리 0):
 *    /evidence/alcohol                     전체 1쪽
 *    /evidence/alcohol/page/3              전체 3쪽
 *    /evidence/alcohol/topic/youth         청소년 1쪽
 *    /evidence/alcohol/topic/youth/page/2  청소년 2쪽
 *  하위 주제 = 제목 + 서재 요약(findings_ko)의 낱말 규칙(아래 RULES) — 모델 호출 0 · 카드 글 바꿈 0.
 *    한 카드가 여러 주제에 들 수 있다 · 어느 규칙에도 안 걸리면 「그 밖」.
 *  카드 순서는 cardsOfType 그대로(연도 내림 → approved_at 내림 → card_id).
 *
 * 의존 없음(시험: evidencePages.test.mts).
 */
import type { EvidenceCard } from './statoryEvidence.ts';

export const PAGE_SIZE = 40;
export const SPLIT_OVER = 100;

export const SUBTOPICS = ['prevention', 'treatment', 'policy', 'youth', 'other'] as const;
export type Subtopic = (typeof SUBTOPICS)[number];

/** 낱말 규칙 — 「법」 한 글자는 「방법」 에 걸려 쓰지 않음(법률 · 법적 · 법안 · 입법만). */
const RULES: Record<Exclude<Subtopic, 'other'>, RegExp> = {
  prevention:
    /예방|prevent|금주\s*교육|조기\s*개입|선별|screening|brief intervention|인식\s*개선|캠페인|campaign|awareness/i,
  treatment:
    /치료|treatment|therap|재활|회복|recovery|약물요법|pharmacother|상담|counsel|중재|intervention|임상시험|clinical trial|randomi[sz]ed|해독|detox|금단|withdrawal|naltrexone|acamprosate|disulfiram/i,
  policy:
    /정책|\bpolic(y|ies)|규제|regulat|법률|법적|법안|입법|\blaws?\b|legislat|세금|주세|과세|\btax(es|ation)?\b|가격|\bpric(e|es|ing)\b|광고|advertis|marketing|판매|\bsales\b|면허|licens|minimum unit|제도/i,
  youth:
    /청소년|adolescen|youth|\bteen(s|age|aged|ager|agers)?\b|학생|student|아동|child|미성년|\bminors?\b|대학생|college|university|청년|young (people|adult)|초등|중학|고등학/i,
};

export const isSubtopic = (v: string): v is Subtopic =>
  (SUBTOPICS as readonly string[]).includes(v);

/** 카드의 하위 주제(하나 이상) — 규칙에 안 걸리면 ['other'] */
export function subtopicsOf(c: Pick<EvidenceCard, 'title' | 'findings_ko'>): Subtopic[] {
  const text = [c.title, c.findings_ko].filter(Boolean).join('\n');
  const hit = (Object.keys(RULES) as Array<keyof typeof RULES>).filter((k) => RULES[k].test(text));
  return hit.length ? hit : ['other'];
}

export const isSplit = (n: number) => n > SPLIT_OVER;

/** 쪽 하나가 보여 줄 것 — topic null = 전체 */
export interface EvidenceView {
  topic: Subtopic | null;
  page: number;
}

/** 주소 꼬리 → 보기. 틀린 꼴(page/1 · 숫자 아님 · 모르는 주제 · 군더더기)은 null(→ 404). */
export function parseRest(rest: string[] | undefined): EvidenceView | null {
  const r = rest ?? [];
  let i = 0;
  let topic: Subtopic | null = null;
  let page = 1;
  if (r[i] === 'topic') {
    const t = r[i + 1];
    if (!t || !isSubtopic(t)) return null;
    topic = t;
    i += 2;
  }
  if (r[i] === 'page') {
    const p = r[i + 1];
    if (!p || !/^[1-9]\d*$/.test(p) || p === '1') return null;
    page = Number(p);
    i += 2;
  }
  return i === r.length ? { topic, page } : null;
}

/** 보기 → 주소 꼬리(parseRest 의 거꾸로) */
export function restOf(view: EvidenceView): string[] {
  return [
    ...(view.topic ? ['topic', view.topic] : []),
    ...(view.page > 1 ? ['page', String(view.page)] : []),
  ];
}

export const hrefOf = (type: string, view: EvidenceView) =>
  ['', 'evidence', type, ...restOf(view)].join('/');

export interface TopicCount {
  topic: Subtopic;
  n: number;
}

/** 주제별 카드 수(SUBTOPICS 순서 · 0 인 주제도 넣음) */
export function topicCounts(cards: EvidenceCard[]): TopicCount[] {
  const n = new Map<Subtopic, number>(SUBTOPICS.map((t) => [t, 0]));
  for (const c of cards) for (const t of subtopicsOf(c)) n.set(t, (n.get(t) ?? 0) + 1);
  return SUBTOPICS.map((topic) => ({ topic, n: n.get(topic) ?? 0 }));
}

export interface PageSlice {
  cards: EvidenceCard[];
  /** 거른 뒤 카드 수 */
  total: number;
  page: number;
  pages: number;
  /** 1부터 · 이 쪽 첫 카드와 끝 카드의 순번(카드 0 이면 0 · 0) */
  from: number;
  to: number;
}

/** 보기대로 거르고 자른다. 나눔 밖(≤100장)이면 전체 한 쪽. 쪽 번호가 범위 밖이면 null(→ 404). */
export function sliceView(cards: EvidenceCard[], view: EvidenceView): PageSlice | null {
  if (!isSplit(cards.length)) {
    if (view.topic || view.page > 1) return null;
    return { cards, total: cards.length, page: 1, pages: 1, from: cards.length ? 1 : 0, to: cards.length };
  }
  const pool = view.topic ? cards.filter((c) => subtopicsOf(c).includes(view.topic!)) : cards;
  const pages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
  if (view.page > pages) return null;
  const start = (view.page - 1) * PAGE_SIZE;
  const shown = pool.slice(start, start + PAGE_SIZE);
  return {
    cards: shown,
    total: pool.length,
    page: view.page,
    pages,
    from: shown.length ? start + 1 : 0,
    to: start + shown.length,
  };
}

/** 한 유형의 모든 정적 주소 꼬리(generateStaticParams) — 카드 0 인 주제는 만들지 않음 */
export function allRests(cards: EvidenceCard[]): string[][] {
  if (!isSplit(cards.length)) return [[]];
  const out: string[][] = [];
  for (const topic of [null, ...SUBTOPICS] as Array<Subtopic | null>) {
    const n = topic ? cards.filter((c) => subtopicsOf(c).includes(topic)).length : cards.length;
    if (topic && n === 0) continue;
    const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
    for (let page = 1; page <= pages; page++) out.push(restOf({ topic, page }));
  }
  return out;
}
