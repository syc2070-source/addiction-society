/**
 * 중독 유형 여섯과 고정색 (SOC-R19 ■4) — 그래프 · 연대기 점 · 근거 카드 꼬리표 · 지표 카드가 같이 쓴다.
 *
 * 색 값은 globals.css 의 --type-<key> 한 곳에만 있다(이 파일은 이름과 짝만).
 * 고른 색 = dataviz 기본 범주 팔레트에서 여섯(validate_palette.js light · 인접 쌍 CVD ΔE ≥ 9.2 PASS).
 * 여섯을 한 그림에 겹치면 모든 쌍 검사가 FAIL 이라 홈 v2 는 겹치지 않고 2×3 작은 그림으로 나눈다.
 * 색만으로 뜻을 싣지 않는다 — 언제나 유형 이름이 옆에 붙는다.
 *
 * 분류는 규칙(코드 표 · 출처 domain · 제목 낱말)만 — 모델 호출 0. 의존 없음(시험: addictionTypes.test.mts).
 */

export const ADDICTION_TYPES = [
  'alcohol',
  'gambling',
  'drug',
  'smartphone',
  'game',
  'tobacco',
] as const;

export type AddictionType = (typeof ADDICTION_TYPES)[number];

/** CSS 변수 이름(값은 globals.css) */
export function typeColorVar(type: AddictionType | null): string {
  return type ? `var(--type-${type})` : 'var(--type-none)';
}

/** 어두운 바탕용 짝(SOC-R20 ■1 · 값은 globals.css --type-<key>-dark) */
export function typeColorVarDark(type: AddictionType | null): string {
  return type ? `var(--type-${type}-dark)` : 'var(--type-none-dark)';
}

/** 유형 경로 이름인지(/evidence/<type>) */
export function isAddictionType(v: string): v is AddictionType {
  return (ADDICTION_TYPES as readonly string[]).includes(v);
}

/** 대표 지표가 중독 지표가 아닌 것(SOC-R20 ■4 · 게임 과몰입 계열이 자료에 없어 이용률로 그림) */
export const NOT_ADDICTION_INDICATORS: ReadonlySet<string> = new Set([
  'kocca_game_usage_rate',
]);

/** 홈 v2 그림의 유형별 대표 지표 — 한국 · 전체값 시계열(■0-4 실측으로 고름). */
export const TYPE_REPRESENTATIVE: Record<AddictionType, string> = {
  alcohol: 'knhanes_high_risk_drinking_rate',
  gambling: 'kcgp_youth_gambling_problem_rate',
  drug: 'spo_drug_offenders_total',
  smartphone: 'nia_smartphone_overdependence_rate',
  game: 'kocca_game_usage_rate',
  tobacco: 'knhanes_current_smoking_rate',
};

/** 지표 코드 → 유형(표에 없으면 코드 낱말로). */
export function indicatorType(code: string): AddictionType | null {
  for (const t of ADDICTION_TYPES) if (TYPE_REPRESENTATIVE[t] === code) return t;
  if (/alcohol|drinking/.test(code)) return 'alcohol';
  if (/gambling|kcgp/.test(code)) return 'gambling';
  if (/drug|unodc/.test(code)) return 'drug';
  if (/smartphone|nia_/.test(code)) return 'smartphone';
  if (/game|kocca/.test(code)) return 'game';
  if (/smoking|tobacco/.test(code)) return 'tobacco';
  return null;
}

/** 출처 → 유형. digital 은 게임 출처(kocca)만 게임, 나머지는 스마트폰. policy · multi 는 유형 없음. */
export function sourceType(
  source: { id?: string | null; domain?: string | null } | null | undefined,
): AddictionType | null {
  if (!source) return null;
  const id = source.id ?? '';
  switch (source.domain) {
    case 'alcohol':
      return 'alcohol';
    case 'gambling':
      return 'gambling';
    case 'drug':
      return 'drug';
    case 'tobacco':
      return 'tobacco';
    case 'digital':
      return /game|kocca/.test(id) ? 'game' : 'smartphone';
    default:
      return null;
  }
}

/** 제목 낱말 → 유형(방송 제목 등). 낱말이 없거나 둘 이상 유형이 걸리면 null(어림하지 않음). */
const TITLE_WORDS: Array<[AddictionType, RegExp]> = [
  ['alcohol', /알코올|음주|alcohol|drinking/i],
  ['gambling', /도박|gambl/i],
  ['drug', /마약|약물|drug/i],
  ['smartphone', /스마트폰|휴대폰|smartphone/i],
  ['game', /게임|gaming|\bgame/i],
  ['tobacco', /담배|흡연|니코틴|tobacco|smok|vap/i],
];

export function titleType(title: string | null | undefined): AddictionType | null {
  if (!title) return null;
  const hits = TITLE_WORDS.filter(([, re]) => re.test(title)).map(([t]) => t);
  return hits.length === 1 ? hits[0] : null;
}
