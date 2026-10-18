/**
 * 영어 화면의 단위·출처 이름 (SOC-R8 ■4).
 *
 * 지표 단위(indicators.unit)와 출처 짧은 이름(sources.org)은 한국어로 저장된 것이 있어
 * en 홈 「오늘의 숫자」에 「23,403 명 · Source 대검찰청」처럼 나왔다(10-17 실측).
 * DB 값은 그대로 두고(값 변경 0) en 에서만 여기 표로 바꿔 보인다.
 *  - 단위: 한국어 단위만 표에 둔다('%' · 'L' 은 그대로).
 *  - 출처: org 가 한글인 출처만 영어 공식 이름. 그 밖은 org(이미 영어 약칭).
 * 표에 없는 한글 값은 원래 값 그대로(지어내지 않음) — 시험이 seed 의 한글 org 를 모두 덮는지 본다.
 *
 * 의존 없음(시험: node --test src/lib/enLabels.test.mts).
 */

export const UNIT_EN: Record<string, string> = {
  명: 'persons',
  '백만 명': 'million people',
};

/** 출처 id → 영어 공식 이름(org 가 한글인 출처만). */
export const ORG_EN: Record<string, string> = {
  mohw_addiction_center: 'Ministry of Health and Welfare',
  spo_drug_monthly: "Supreme Prosecutors' Office",
  drugfree_stats: 'Korean Association Against Drug Abuse',
  kcgp_youth: 'Korea Center on Gambling Problems',
  kcgp_rehab: 'Korea Center on Gambling Problems',
  ncmh_mhs: 'National Center for Mental Health',
  ngcc_gambling: 'National Gambling Control Commission',
};

export function unitLabel(
  unit: string | null | undefined,
  locale: string,
): string {
  if (!unit) return '';
  return locale === 'en' ? (UNIT_EN[unit] ?? unit) : unit;
}

/** en: 영어 이름 → org → orgKo · ko: orgKo → org. */
export function orgLabel(
  src: {
    id?: string | null;
    org?: string | null;
    orgKo?: string | null;
  },
  locale: string,
): string {
  if (locale === 'en') {
    return (src.id ? ORG_EN[src.id] : undefined) ?? src.org ?? src.orgKo ?? '';
  }
  return src.orgKo || src.org || '';
}
