/**
 * 논문 제목 → 한국어 한 줄 (SOC-R19 ■2-③) — 주제 · 척도 · 표본 낱말만 · 번역 0 · 모델 0.
 *
 * 영어 제목에서 정해진 낱말 표(아래)에 걸리는 것만 한국어 낱말로 바꿔 세 칸에 담는다.
 * 문장을 짓지 않는다 — 걸린 낱말이 없으면 그 칸은 비우고, 세 칸이 다 비면 한 줄 자체가 없다(null).
 * 척도는 근거 지도 묶음의 「많이 쓰인 척도」 이름이 제목에 그대로 있을 때만.
 * Statory 카드에 한글 칸이 생기면 이 규칙은 그 칸으로 바뀐다(R20 이후).
 *
 * 의존 없음(시험: paperLine.test.mts).
 */

const TOPIC: Array<[RegExp, string]> = [
  [/\bgambl/i, '도박'],
  [/\balcohol|\bdrinking\b/i, '알코올'],
  [/\bdrug|substance|illicit/i, '약물'],
  [/\bsmartphone/i, '스마트폰'],
  [/\bgaming\b|\bvideo game/i, '게임'],
  [/\btobacco|smoking|nicotine/i, '담배'],
  [/comorbid/i, '공존질환'],
  [/impulsiv/i, '충동성'],
  [/\bdependence\b/i, '의존'],
  [/\btreatment|therap/i, '치료'],
  [/naltrexone/i, '날트렉손'],
  [/recovery/i, '회복'],
  [/prevalence/i, '유병률'],
  [/risk and protective|risk factor|protective factor/i, '위험·보호 요인'],
  [/burden of disease/i, '질병 부담'],
  [/psychiatric/i, '정신질환'],
  [/insurance/i, '보험'],
  [/coping/i, '대처 기술'],
  [/systematic review/i, '체계적 문헌고찰'],
  [/meta-analys/i, '메타분석'],
  [/longitudinal/i, '종단 연구'],
  [/controlled (study|trial)|randomi[sz]ed/i, '통제 연구'],
];

const SAMPLE: Array<[RegExp, string]> = [
  [/adolescen|youth|teen/i, '청소년'],
  [/\bchild/i, '아동'],
  [/\bstudent/i, '학생'],
  [/\bmales?\b|\bmen\b/i, '남성'],
  [/\bfemales?\b|\bwomen\b/i, '여성'],
  [/\bolder adult|elderly/i, '노인'],
  [/low ses|low socioeconomic/i, '저소득층'],
  [/\bveteran/i, '참전 군인'],
  [/national epidemiologic|national survey/i, '전국 조사'],
  [/\bglobal\b|worldwide/i, '세계'],
];

export interface PaperLine {
  topics: string[];
  instruments: string[];
  samples: string[];
}

const pick = (title: string, table: Array<[RegExp, string]>) => [
  ...new Set(table.filter(([re]) => re.test(title)).map(([, ko]) => ko)),
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function paperLine(
  title: string,
  instrumentNames: string[] = [],
): PaperLine | null {
  const topics = pick(title, TOPIC);
  const samples = pick(title, SAMPLE);
  const instruments = instrumentNames.filter((n) =>
    new RegExp(`(^|[^A-Za-z0-9-])${escape(n)}($|[^A-Za-z0-9-])`).test(title),
  );
  if (topics.length + samples.length + instruments.length === 0) return null;
  return { topics, instruments, samples };
}
