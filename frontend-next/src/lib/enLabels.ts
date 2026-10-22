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
 * SOC-R9 ■1: 지표 정의·읽는 법·관측치 단서(enIndicators) · 정책 문서 · 회복 기관(romanize) ·
 * 연구실 요약까지. en 에서 표에 없는 한국어는 빈칸으로 둔다(한국어를 내보내지 않음) —
 * 단, 출처 짧은 이름은 위 규칙 그대로.
 *
 * 의존 없음(시험: node --test src/lib/enLabels.test.mts).
 */
import {
  DEFINITION_EN,
  METHOD_NOTE_EN,
  OBSERVATION_NOTE_EN,
} from './enIndicators.ts';
import {
  BROADCAST_NAMES_EN,
  type BroadcastNameEn,
} from './broadcastNamesEn.ts';
import { romanizeAddress } from './romanize.ts';

const HANGUL = /[가-힣ㄱ-ㆎ]/;

/** en: 한글이 없으면 그대로, 있으면 빈칸 */
function englishOnly(text: string | null | undefined): string {
  return text && !HANGUL.test(text) ? text : '';
}

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

// ── SOC-R9 ■1 지표 ────────────────────────────────────────────

type IndicatorText = {
  code: string;
  definitionKo?: string | null;
  methodNote?: string | null;
};

/** 지표 정의 — en: 영어 표 → (한글 없는 원문) → 빈칸 */
export function definitionLabel(ind: IndicatorText, locale: string): string {
  if (locale !== 'en') return ind.definitionKo ?? '';
  return DEFINITION_EN[ind.code] ?? englishOnly(ind.definitionKo);
}

/** 이 지표 읽는 법(methodNote) */
export function methodNoteLabel(ind: IndicatorText, locale: string): string {
  if (locale !== 'en') return ind.methodNote ?? '';
  return METHOD_NOTE_EN[ind.code] ?? englishOnly(ind.methodNote);
}

/** 관측치 단서 — 지표 code · 기간으로 찾는다 */
export function observationNoteLabel(
  code: string,
  obs: { period: string; note?: string | null },
  locale: string,
): string {
  if (locale !== 'en') return obs.note ?? '';
  if (!obs.note) return '';
  return OBSERVATION_NOTE_EN[code]?.[obs.period] ?? englishOnly(obs.note);
}

// ── 정책 문서 ────────────────────────────────────────────────

/** documents.seed SCOPE_COUNTRY 의 한국어 값 → 영어 */
export const COUNTRY_EN: Record<string, string> = {
  대한민국: 'Republic of Korea',
  국제: 'International',
  '지역(EU 등)': 'Regional (EU etc.)',
};

/** documents.data.json 법률 6 — 법제처 영문 법령 이름 */
export const LAW_TITLE_EN: Record<string, string> = {
  '정신건강증진 및 정신질환자 복지서비스 지원에 관한 법률':
    'Act on the Improvement of Mental Health and the Support for Welfare Services for Mental Patients',
  사행산업통합감독위원회법: 'National Gambling Control Commission Act',
  '마약류 관리에 관한 법률': 'Act on the Control of Narcotics, etc.',
  '지능정보화 기본법': 'Framework Act on Intelligent Informatization',
  '게임산업진흥에 관한 법률': 'Game Industry Promotion Act',
  '청소년 보호법': 'Juvenile Protection Act',
};

export function countryLabel(
  country: string | null | undefined,
  locale: string,
): string {
  if (!country) return '';
  if (locale !== 'en') return country;
  return COUNTRY_EN[country] ?? englishOnly(country);
}

/**
 * 문서 제목. 출처 대표 문서는 seed 가 summary 에 출처 영어 제목(titleEn)을 넣는다.
 * en: 법률 영문 이름 → (출처 문서면 summary) → 한글 없는 제목 → 빈칸.
 */
export function documentTitleLabel(
  d: { title: string; summary?: string | null; sourceId?: string | null },
  locale: string,
): string {
  if (locale !== 'en') return d.title;
  if (LAW_TITLE_EN[d.title]) return LAW_TITLE_EN[d.title];
  if (d.sourceId && d.summary && !HANGUL.test(d.summary)) return d.summary;
  return englishOnly(d.title);
}

// ── 회복 기관 ────────────────────────────────────────────────

export const CITY_EN: Record<string, string> = {
  서울: 'Seoul',
  부산: 'Busan',
  대구: 'Daegu',
  인천: 'Incheon',
  광주: 'Gwangju',
  대전: 'Daejeon',
  울산: 'Ulsan',
  세종: 'Sejong',
  경기: 'Gyeonggi',
  경기남부: 'Gyeonggi South',
  경기북부: 'Gyeonggi North',
  강원: 'Gangwon',
  충북: 'Chungbuk',
  충남: 'Chungnam',
  전북: 'Jeonbuk',
  전남: 'Jeonnam',
  경북: 'Gyeongbuk',
  경남: 'Gyeongnam',
  제주: 'Jeju',
};

/** recovery-directory 의 설명 2 종 */
export const RECOVERY_DESC_EN: Record<string, string> = {
  '알코올 등 4대 중독 문제의 통합 상담·재활 지원 (보건복지부 지정 중독관리통합지원센터)':
    'Integrated counseling and rehabilitation for the four major addictions, including alcohol (Addiction Management Center designated by the Ministry of Health and Welfare)',
  '인터넷·스마트폰 과의존 예방 및 상담 (한국지능정보사회진흥원 스마트쉼센터)':
    'Prevention and counseling for internet and smartphone overdependence (Smart Shim Center, National Information Society Agency)',
};

/** 기관 종류 — 이름 끝(긴 것부터) */
const CENTER_KIND_EN: [string, string][] = [
  ['광역중독관리통합지원센터', 'Metropolitan Addiction Management Center'],
  ['중독관리통합지원센터', 'Addiction Management Center'],
  ['스마트쉼센터', 'Smart Shim Center'],
];

/**
 * 기관 유형 뜻 (SOC-R10 ■2) — 73 곳의 type 은 모두 counseling 이라 이름 끝으로 가른다
 * (10-21 실측: 중독관리통합지원센터 57 · 광역 6 · 스마트쉼센터 10). 이름은 로마자 그대로 두고
 * en 에서만 이 뜻을 붙인다(「Shim」 같은 로마자만 남는 자리를 없앰).
 */
export const RECOVERY_KIND_EN: [string, string][] = [
  [
    '광역중독관리통합지원센터',
    'Metropolitan addiction center — coordinates the local centers of its province (Ministry of Health and Welfare)',
  ],
  [
    '중독관리통합지원센터',
    'Community addiction center — counseling and rehabilitation for alcohol, drugs, gambling and internet (Ministry of Health and Welfare)',
  ],
  [
    '스마트쉼센터',
    'Smart Rest Center ("shim" = rest) — internet and smartphone overdependence (National Information Society Agency)',
  ],
];

/** en: 기관 유형 뜻 · ko: 빈칸(이름에 이미 한국어 유형이 있음) */
export function recoveryKindLabel(name: string, locale: string): string {
  if (locale !== 'en') return '';
  return RECOVERY_KIND_EN.find(([ko]) => name.endsWith(ko))?.[1] ?? '';
}

export function cityLabel(city: string | null | undefined, locale: string) {
  if (!city) return '';
  if (locale !== 'en') return city;
  return CITY_EN[city] ?? romanizeAddress(city);
}

/** 「광주광산구」 → Gwangju Gwangsan-gu · 「경기남부」 → Gyeonggi South */
function regionPrefix(prefix: string): string {
  if (CITY_EN[prefix]) return CITY_EN[prefix];
  for (const metro of Object.keys(CITY_EN)) {
    if (metro.length === 2 && prefix.startsWith(metro) && prefix.length > 2) {
      return `${CITY_EN[metro]} ${romanizeAddress(prefix.slice(2))}`;
    }
  }
  return romanizeAddress(prefix);
}

export function recoveryNameLabel(name: string, locale: string): string {
  if (locale !== 'en') return name;
  for (const [ko, en] of CENTER_KIND_EN) {
    if (name.endsWith(ko)) {
      const prefix = name.slice(0, -ko.length).trim();
      return prefix ? `${regionPrefix(prefix)} ${en}` : en;
    }
  }
  return romanizeAddress(name);
}

export function recoveryAddressLabel(
  address: string | null | undefined,
  locale: string,
): string {
  if (!address) return '';
  return locale === 'en' ? romanizeAddress(address) : address;
}

export function recoveryDescLabel(
  desc: string | null | undefined,
  locale: string,
): string {
  if (!desc) return '';
  if (locale !== 'en') return desc;
  return RECOVERY_DESC_EN[desc] ?? englishOnly(desc);
}

// ── 연구실(Statory 보고서) ─────────────────────────────────────

/** 보고서 id → 영어 요약 (summary_ko 뿐인 것) */
export const LAB_SUMMARY_EN: Record<string, string> = {
  'b1000002-0002-4002-8002-000000000002':
    'From risk society to addiction society — addiction read through the history of civilization, from the cognitive revolution to AGI. (Material compiled and reviewed with AI)',
  'b1000001-0001-4001-8001-000000000001':
    'An introduction by topic — from the concept of addiction to gambling, substance and behavioral addictions, psychology, policy and recovery. (Material compiled and reviewed with AI)',
};

export function labSummaryLabel(
  r: { id: string; summary_ko?: string | null },
  locale: string,
): string {
  if (locale !== 'en') return r.summary_ko ?? '';
  return LAB_SUMMARY_EN[r.id] ?? englishOnly(r.summary_ko);
}

// ── 분해 집단(observations.qualifier 'group=…') — 리뷰 수리 ──────────

/** PDF 추출 분해 집단의 흔한 이름(entity 주석 예: 남학생 · 중학교) */
export const GROUP_EN: Record<string, string> = {
  전체: 'Total',
  남자: 'Men',
  여자: 'Women',
  남성: 'Male',
  여성: 'Female',
  남학생: 'Boys',
  여학생: 'Girls',
  초등학교: 'Elementary school',
  중학교: 'Middle school',
  고등학교: 'High school',
  초등학생: 'Elementary students',
  중학생: 'Middle school students',
  고등학생: 'High school students',
  청소년: 'Youth',
  성인: 'Adults',
};

/** en: 표의 영어 → 한글 없는 원래 이름 → 「Subgroup」(한국어를 내보내지 않음) */
export function groupLabel(group: string, locale: string): string {
  if (locale !== 'en') return group;
  if (GROUP_EN[group]) return GROUP_EN[group];
  if (!HANGUL.test(group)) return group;
  return 'Subgroup';
}

/** 연구실 보고서 제목 — en: title_en → 한글 없는 title_ko → 「Lab report」 (리뷰 수리) */
export function reportTitleLabel(
  r: { title_ko: string; title_en?: string | null },
  locale: string,
): string {
  if (locale !== 'en') return r.title_ko;
  return englishOnly(r.title_en) || englishOnly(r.title_ko) || 'Lab report';
}

// ── 연대기 「방송」 줄 (SOC-R10 ■2 — 10-21 04:00 첫 방송 1 건이 /en 에 한국어로 보임 · SOC-R11 ■3 이름 표) ──

/**
 * 중독뉴스 내보내기의 영어 이름 칸 `sourceEn`(NEWS-Q12 ■4 · 칸 이름은 그쪽이 정한 대로 · 10-22 그쪽 작업본 실측:
 * 값 = 채널 설정 program_en · 방송사가 앞에 붙음 「MBC PD Notebook」) — 자리만. 연대기 응답에 실려 오면 표보다 먼저 읽는다.
 * 단 함께 쓰는 채널(표의 channel)은 그 편의 프로그램을 넘겨짚지 않게 표의 채널 이름이 이긴다.
 */
export interface BroadcastExportedEn {
  sourceEn?: string | null;
}

/**
 * 방송사 — en: 표(SOC-R11) → 한글 없는 이름 → 한글 낱말을 뺀 라틴 부분(「KBS 다큐인사이트」 → KBS)
 * → 내보내기 sourceEn 의 첫 낱말 → 빈칸
 */
export function broadcasterLabel(
  name: string | null | undefined,
  locale: string,
  exported?: BroadcastExportedEn,
): string {
  if (!name) return '';
  if (locale !== 'en') return name;
  return (
    BROADCAST_NAMES_EN[name.trim()]?.broadcaster ||
    englishOnly(name) ||
    name
      .split(/\s+/)
      .filter((w) => w && !HANGUL.test(w))
      .join(' ') ||
    englishOnly(exported?.sourceEn).split(/\s+/)[0] ||
    ''
  );
}

/** 함께 쓰는 채널이면 채널 이름(그 편의 프로그램을 넘겨짚지 않음) · 아니면 프로그램 이름 */
function shownProgram(n: BroadcastNameEn | undefined): string {
  return n ? (n.channel ?? n.program) : '';
}

/** sourceEn 「MBC PD Notebook」 → 방송사 칸과 겹치는 앞 낱말을 뺀 「PD Notebook」(「Newstapa」 처럼 같으면 그대로) */
function exportedProgram(
  sourceEn: string | null | undefined,
  broadcasterEn: string,
): string {
  const en = englishOnly(sourceEn).trim();
  if (!en || !broadcasterEn || en === broadcasterEn) return en;
  return en.startsWith(`${broadcasterEn} `)
    ? en.slice(broadcasterEn.length + 1)
    : en;
}

/**
 * 방송 제목 — en: 한글 없는 제목 → 「프로그램 영어 이름 (Korean)」(내보내기 칸 → 표)
 * → 「Korean-language programme」. 제목은 번역하지 않는다(원문 제목은 지어내지 않음).
 */
export function broadcastTitleLabel(
  title: string,
  locale: string,
  broadcaster?: string | null,
  exported?: BroadcastExportedEn,
): string {
  if (locale !== 'en') return title;
  const row = broadcaster ? BROADCAST_NAMES_EN[broadcaster.trim()] : undefined;
  const program =
    row?.channel ||
    exportedProgram(
      exported?.sourceEn,
      broadcasterLabel(broadcaster, locale, exported),
    ) ||
    shownProgram(row);
  return (
    englishOnly(title) ||
    (program ? `${program} (Korean)` : 'Korean-language programme')
  );
}

/** en 에서 한국어만 있는 글(결론 등)은 빈칸 */
export function englishOrEmpty(
  text: string | null | undefined,
  locale: string,
): string {
  if (locale !== 'en') return text ?? '';
  return englishOnly(text);
}
