/**
 * 연구 자료 관련성 관문 (SOC-0 → SOC-R1 ■5) — 순수 함수, DB 접근 없음.
 *
 * 공개 화면에는 "승인 + 분야와 관련된" 자료만 보인다. 핵심어·기준·수집기 검색어는
 * 모두 분야 설정 파일(backend/data/field_profiles/<FIELD_PROFILE>.json, 기본
 * addiction)에서 읽는다 — 이 파일에는 분야 글자가 없다. 기준을 고친 까닭은
 * 설정 파일의 gate.research._comment 에 적었다.
 *
 * 판정: 제목 title_min · 키워드 keywords_min · 초록 abstract_min 회 이상 중 하나.
 * 키워드에서 수집기 자기 검색어(sources.academic[].queries)는 뺀다 — 수집 경로이지
 * 문헌 내용이 아니다.
 */
import {
  academicQueryTerms,
  FieldProfile,
  loadFieldProfile,
} from '../common/field-profile';

interface Gate {
  ko: readonly string[];
  /** 횟수를 세기 위한 전역(g) 정규식. */
  counters: readonly RegExp[];
  collectorTerms: ReadonlySet<string>;
  titleMin: number;
  keywordsMin: number;
  abstractMin: number;
}

/** 설정 파일 → 판정기. 영어 정규식은 대소문자 무시, 약어 목록만 대소문자 구분. */
export function buildGate(profile: FieldProfile): Gate {
  const strong = profile.keywords.strong;
  const g = profile.gate.research;
  const counters = [
    ...strong.en_patterns.map((src) => new RegExp(src, 'ig')),
    ...(strong.en_patterns_case_sensitive ?? []).map(
      (src) => new RegExp(src, 'g'),
    ),
  ];
  const collector = g.exclude_collector_keywords
    ? academicQueryTerms(profile).map((t) => t.toLowerCase())
    : [];
  return {
    ko: strong.ko,
    counters,
    collectorTerms: new Set(collector),
    titleMin: g.title_min,
    keywordsMin: g.keywords_min,
    abstractMin: g.abstract_min,
  };
}

const gate = buildGate(loadFieldProfile());

/** 초록은 이 횟수 이상 핵심어가 나와야 통과(우연 언급 배제). 설정 파일 값. */
export const ABSTRACT_MIN_HITS = gate.abstractMin;

/** 키워드 판정에서 빼는 수집기 검색어(설정 파일 sources.academic). */
export const COLLECTOR_QUERY_TERMS: readonly string[] = [
  ...gate.collectorTerms,
];

export interface RelevanceInput {
  title?: string | null;
  abstract?: string | null;
  keywords?: readonly string[] | null;
}

/** 핵심어 등장 횟수(한국어 부분 문자열 + 영어 패턴, 겹침 허용). */
export function countFieldTerms(text: string | null | undefined): number {
  if (!text) return 0;
  let hits = 0;
  for (const t of gate.ko) hits += text.split(t).length - 1;
  for (const re of gate.counters) hits += text.match(re)?.length ?? 0;
  return hits;
}

export interface RelevanceVerdict {
  pass: boolean;
  /** 제목·키워드·초록 핵심어 등장 합계(기록용). */
  score: number;
  /** 사람이 읽는 판정 근거, 예: "통과: 제목 2" · "실패: 제목 0 · 키워드 0 · 초록 2(<3)". */
  reason: string;
  hits: { title: number; keywords: number; abstract: number };
}

/** 관문 판정 + 근거 (SOC-R1). isFieldRelevant 는 이 판정의 pass 다. */
export function relevanceVerdict(item: RelevanceInput): RelevanceVerdict {
  const title = countFieldTerms(item.title);
  const keywords = (item.keywords ?? [])
    .filter((k) => !gate.collectorTerms.has(k.trim().toLowerCase()))
    .reduce((n, k) => n + countFieldTerms(k), 0);
  const abstract = countFieldTerms(item.abstract);
  const hits = { title, keywords, abstract };
  const score = title + keywords + abstract;
  const passedBy: string[] = [];
  if (title >= gate.titleMin) passedBy.push(`제목 ${title}`);
  if (keywords >= gate.keywordsMin) passedBy.push(`키워드 ${keywords}`);
  if (abstract >= gate.abstractMin) passedBy.push(`초록 ${abstract}`);
  if (passedBy.length > 0) {
    return { pass: true, score, reason: `통과: ${passedBy.join(' · ')}`, hits };
  }
  return {
    pass: false,
    score,
    reason: `실패: 제목 ${title} · 키워드 ${keywords} · 초록 ${abstract}(<${gate.abstractMin})`,
    hits,
  };
}

/** 제목·키워드(수집기 검색어 제외)·초록 중 하나가 기준 이상이면 true. */
export function isFieldRelevant(item: RelevanceInput): boolean {
  return relevanceVerdict(item).pass;
}

export interface VisibilityInput extends RelevanceInput {
  status?: string | null;
  reviewDecision?: string | null;
}

/**
 * 공개 규칙 하나 (SOC-R1): 승인 이고 (관문 통과 또는 keep) 이고 hide 아님.
 * 목록·검색·featured·stats·상세가 모두 이 함수만 쓴다. 관리자 길은 쓰지 않는다.
 */
export function isPubliclyVisible(item: VisibilityInput): boolean {
  if (item.status !== 'approved') return false;
  if (item.reviewDecision === 'hide') return false;
  if (item.reviewDecision === 'keep') return true;
  return isFieldRelevant(item);
}

/** relevance_* 세 칸에 쓸 값 (collect:research 신규분 · 기존 행 보충). */
export function relevanceColumns(
  item: RelevanceInput,
  checkedAt: Date = new Date(),
): {
  relevanceScore: string;
  relevanceReason: string;
  relevanceCheckedAt: Date;
} {
  const v = relevanceVerdict(item);
  return {
    relevanceScore: String(v.score),
    relevanceReason: v.reason,
    relevanceCheckedAt: checkedAt,
  };
}

/**
 * collect:research 신규 저장 status. 관문 실패면 'pending'(공개 안 됨, 검토 대기).
 * 기존 행 status 는 수집기가 건드리지 않는다(사람 결정 보존).
 */
export function collectedStatus(item: RelevanceInput): 'approved' | 'pending' {
  return isFieldRelevant(item) ? 'approved' : 'pending';
}
