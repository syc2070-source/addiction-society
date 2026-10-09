/**
 * 연구 자료 관련성 관문 (SOC-0) — 순수 함수, DB 접근 없음.
 *
 * 공개 화면에는 "승인 + 중독과 관련된" 자료만 보인다(목표 ①).
 * collect:research 가 인용수 상위 문헌을 그대로 승인 저장해 PRISMA·심방세동
 * 지침·양자물리 소프트웨어 같은 무관 문헌이 공개됐다. 이 관문은 제목·초록·
 * 키워드에 중독 핵심어가 있어야 통과시킨다.
 *
 * 판정: 제목 1회 이상 · 키워드 1회 이상 · 초록 3회 이상 중 하나.
 * 초록만 3회인 까닭: 운영 실측(2026-10-09, 49건)에서 PANSS 조현병 척도는
 * 초록에 'drug' 2회, 심방세동 지침은 'drugs' 1회로 우연 언급만으로 통과했다.
 * 실제 중독 문헌의 초록은 4~10회였다.
 *
 * 주의: 수집기는 keywords 에 자신의 검색어(예: 'gaming disorder')를 그대로
 * 넣는다. 그 값은 문헌 내용이 아니라 수집 경로이므로 판정에서 제외한다.
 * (수집기 검색어 자체를 고치는 일은 SOC-R1.)
 */

/** collect:research QUERY_PLAN 검색어 — 키워드 판정에서 제외(소문자 비교). */
export const COLLECTOR_QUERY_TERMS: readonly string[] = [
  'alcohol use disorder treatment',
  'opioid use disorder',
  'substance use disorder relapse',
  'gambling disorder',
  'gaming disorder',
  'behavioral addiction',
  'problematic smartphone use',
  'social media addiction',
  'problematic internet use',
  'work addiction workaholism',
  'exercise addiction',
];

/** 한국어 핵심어 — 부분 문자열 일치. */
const KO_TERMS: readonly string[] = [
  '중독',
  '알코올',
  '음주',
  '단주',
  '금주',
  '도박',
  '마약',
  '약물',
  '물질사용',
  '흡연',
  '담배',
  '니코틴',
  '게임',
  '인터넷',
  '스마트폰',
  '디지털',
  '행위중독',
  '회복',
  '재발',
  '갈망',
];

/**
 * 영어 핵심어 — 단어 경계에서 시작하는 일치(대소문자 무시).
 * 끝 경계는 두지 않는 항목(addict·gambl·opioid 등)은 파생형(addiction·
 * gambling·opioids)을 함께 잡기 위함이다.
 */
const EN_PATTERNS: readonly RegExp[] = [
  /\baddict/i, // addiction · addictive · addicted
  /\bsubstance[\s-]use/i,
  /\bSUDs?\b/,
  /\balcohol/i,
  /\bdrinking\b/i,
  /\bgambl/i,
  /\bdrugs?\b/i,
  /\bopioid/i,
  /\bnicotine\b/i,
  /\bsmoking\b/i,
  /\btobacco\b/i,
  /\bcannabis\b/i,
  /\bgaming disorder/i,
  /\binternet\b/i,
  /\bsmartphones?\b/i,
  /\bdependence\b/i,
  /\bcraving/i,
  /\brecovery\b/i,
  /\brelapse/i,
  /\babstinen/i, // abstinence · abstinent
  /\bharm reduction\b/i,
  /\bworkaholi/i, // workaholism — D3 일중독
];

/** 횟수를 세기 위한 전역(g) 사본. */
const EN_COUNTERS: readonly RegExp[] = EN_PATTERNS.map(
  (re) => new RegExp(re.source, `${re.flags}g`),
);

/** 초록은 이 횟수 이상 핵심어가 나와야 통과(우연 언급 배제). */
export const ABSTRACT_MIN_HITS = 3;

export interface RelevanceInput {
  title?: string | null;
  abstract?: string | null;
  keywords?: readonly string[] | null;
}

/** 핵심어 등장 횟수(한국어 부분 문자열 + 영어 패턴, 겹침 허용). */
export function countAddictionTerms(text: string | null | undefined): number {
  if (!text) return 0;
  let hits = 0;
  for (const t of KO_TERMS) hits += text.split(t).length - 1;
  for (const re of EN_COUNTERS) hits += text.match(re)?.length ?? 0;
  return hits;
}

const collectorTerms = new Set(
  COLLECTOR_QUERY_TERMS.map((t) => t.toLowerCase()),
);

/** 제목·키워드(수집기 검색어 제외) 1회 이상 또는 초록 3회 이상이면 true. */
export function isAddictionRelevant(item: RelevanceInput): boolean {
  if (countAddictionTerms(item.title) > 0) return true;
  const keywords = (item.keywords ?? []).filter(
    (k) => !collectorTerms.has(k.trim().toLowerCase()),
  );
  if (keywords.some((k) => countAddictionTerms(k) > 0)) return true;
  return countAddictionTerms(item.abstract) >= ABSTRACT_MIN_HITS;
}

/**
 * collect:research 신규 저장 status. 관문 실패면 'pending'(공개 안 됨, 검토 대기).
 * 기존 행 status 는 수집기가 건드리지 않는다(사람 결정 보존).
 */
export function collectedStatus(item: RelevanceInput): 'approved' | 'pending' {
  return isAddictionRelevant(item) ? 'approved' : 'pending';
}
