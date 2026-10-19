/**
 * 지표 11 의 영어 정의·읽는 법·관측치 단서 (SOC-R9 ■1).
 *
 * DB 의 definitionKo · methodNote · observations.note 는 한국어뿐이다. 칸을 더하면
 * 기존 지표·관측치 행 변경이라(이 판 migration 0) en 정본을 여기 화면 표로 둔다.
 * 관측치 단서는 「지표 code → 기간 → 영어」. 따옴표 안은 한국어 원문 인용을 옮긴 것.
 * 표에 없으면 en 은 빈칸(한국어를 내보내지 않음) — 시험이 seed 의 모든 단서를 덮는지 본다.
 *
 * 의존 없음(시험: node --test src/lib/enLabels.test.mts).
 */

export const DEFINITION_EN: Record<string, string> = {
  who_alcohol_per_capita_kr:
    'Litres of pure alcohol consumed per person aged 15 and over in a year. A WHO estimate that adds recorded consumption (sales and production statistics) and unrecorded consumption (home-made alcohol, tourism and other estimates); a three-year average (SDG 3.5.2).',
  spo_drug_offenders_total:
    "Number of drug offenders apprehended in a year (all narcotics, psychotropic drug and cannabis offenders). The total stated in the Supreme Prosecutors' Office press release on its annual Drug Crime White Paper, carried as published (based on statistics from the prosecution and related agencies).",
  knhanes_high_risk_drinking_rate:
    'Share (%) of adults aged 19 and over who, in the past year, drank on average 7 or more drinks (men) or 5 or more drinks (women) per occasion, at least twice a week. Age-standardized to the 2005 projected population.',
  knhanes_current_smoking_rate:
    'Share (%) of adults aged 19 and over who have smoked at least 5 packs (100 cigarettes) of conventional cigarettes in their lifetime and currently smoke conventional cigarettes. Age-standardized to the 2005 projected population.',
  unodc_global_drug_users:
    'UNODC estimate of the number of people aged 15–64 worldwide who used a drug (excluding alcohol and tobacco) at least once in the past 12 months (millions).',
  kcgp_youth_gambling_problem_group_rate:
    'Share (%) of school students (elementary grade 4 to high school year 3) classified in the problem group (problem gambling, RED) on the gambling problem screening scale.',
  kcgp_youth_gambling_problem_rate:
    'Share (%) of school students (elementary grade 4 to high school year 3) in the at-risk group (moderate risk) plus the problem group (problem gambling) on the gambling problem screening scale. Reported as the "gambling problem level".',
  kcgp_youth_gambling_atrisk_rate:
    'Share (%) of school students (elementary grade 4 to high school year 3) classified in the at-risk group (moderate risk, YELLOW) on the gambling problem screening scale.',
  kcgp_youth_v2:
    'Share (%) of students from elementary grade 4 to high school year 3 who said they have ever (lifetime) gambled themselves — report table "Youth gambling experience rate (lifetime)". This is experience, not the gambling problem screening scale (CAGI at-risk and problem groups).',
  kocca_game_usage_rate:
    'Share (%) of people who played a PC, mobile, console or arcade game at least once in about the year up to the survey — base: all general-public respondents (players and non-players).',
  nia_smartphone_overdependence_rate:
    'Share (%) of smartphone users aged 3–69 classified as high-risk or potential-risk on the smartphone overdependence scale — report wording "overdependence risk group (high-risk + potential-risk)".',
};

/** 「이 지표 읽는 법」(methodNote) */
export const METHOD_NOTE_EN: Record<string, string> = {
  who_alcohol_per_capita_kr:
    'WHO Global Information System on Alcohol and Health (GISAH) · GHO indicator SA_0000001688 · both sexes (SEX_BTSX). A WHO model estimate, not national statistics; when a new edition comes out, past values are recalculated too (current values = 2026-06-15 update). A different yardstick from the KDCA high-risk drinking rate (survey responses).',
  spo_drug_offenders_total:
    "Supreme Prosecutors' Office, Narcotics and Organized Crime Department (formerly the Violent Crime Department and the Anti-Corruption and Violent Crime Department), annual Drug Crime White Paper. The press releases say \"drug offenders\", \"drug offenders apprehended\" or \"number of drug offenders apprehended\". They do not say whether the count is by booking or by indictment. This site does not add up the three offence types itself.",
  knhanes_high_risk_drinking_rate:
    'KDCA Korea National Health and Nutrition Examination Survey (approved national statistics No. 117002). KOSIS table "High-risk drinking rate trend" (orgId=177, tblId=DT_11702_N018), row "aged 19 and over (standardized)". No survey in 2006.',
  knhanes_current_smoking_rate:
    'KDCA Korea National Health and Nutrition Examination Survey (approved national statistics No. 117002) · "2024 Korea Health Statistics". e-Nara Indicators "Drinking and smoking" (idx_cd=2771), table "Current smoking rate" (stts_cd=277103), row "total". From 2019 the term "cigarettes" became "conventional cigarettes".',
  unodc_global_drug_users:
    'UNODC World Drug Report, annual edition. A model estimate pooling national surveys and indirect estimates — the level shifts between editions as new data arrive (e.g. the India and Nigeria surveys in WDR 2019). UNODC: "any comparison of estimates over time should be undertaken with caution, given the wide uncertainty intervals" (WDR 2019 Booklet 2). Period = reference year (published two years later, in June).',
  kcgp_youth_gambling_problem_group_rate:
    'Korea Center on Gambling Problems, Youth Gambling (Problem) Survey. Statistics Korea approval No. 469001. The problem group is defined by the survey\'s gambling problem screening scale.',
  kcgp_youth_gambling_problem_rate:
    'Korea Center on Gambling Problems, Youth Gambling (Problem) Survey. Self-administered group questionnaire during school visits. Statistics Korea approval No. 469001. Definitions and classification follow the survey overview (kcgp.or.kr menuNo=200238) and the results report methodology.',
  kcgp_youth_gambling_atrisk_rate:
    'Korea Center on Gambling Problems, Youth Gambling (Problem) Survey. Statistics Korea approval No. 469001. The at-risk group is defined by the survey\'s gambling problem screening scale.',
  kcgp_youth_v2:
    'Korea Center on Gambling Problems "Youth Gambling Survey" (2024 onward · approved national statistics No. 469001). Because the survey design changed, its figures cannot be compared with the 2015–2022 "Youth Gambling Problem Survey" (2024 report, explanatory note 10) — so it is kept as a separate indicator from kcgp_youth_gambling_*. Weighted values.',
  kocca_game_usage_rate:
    'KOCCA "Game User Survey" (approved national statistics). 2016–2022 ages 10–65 (the 2022 report also says 10–64 in places) · 2023 ages 10–64 · 2024 onward ages 10–69; this series uses the ages 10–64 value the reports give. The method changed a little every year (2023 sample 3,000 → 10,000 · 2024 larger online share) — compare years with caution. The −11.5%p in 2023 falls in the year of the design change.',
  nia_smartphone_overdependence_rate:
    'Ministry of Science and ICT and National Information Society Agency (NIA) "Smartphone Overdependence Survey" (approved national statistics). Face-to-face interviews in 10,000 households nationwide · 20,000–30,000 household members. One "smartphone overdependence scale" since 2016 · ages 3–69 — not comparable with values before 2015 (2025 report p.38). Only the overall values stated in press releases and reports; no calculation here.',
};

/** WHO GHO 표시값(점추정 [구간]) — 해마다 같은 꼴 */
const WHO_SHOWN: Record<string, string> = {
  '2000': '11.0 [9.4 - 12.6]',
  '2001': '11.0 [9.4 - 12.6]',
  '2002': '10.7 [9.2 - 12.4]',
  '2003': '10.0 [8.4 - 11.6]',
  '2004': '9.8 [8.3 - 11.4]',
  '2005': '9.6 [8.1 - 11.1]',
  '2006': '9.5 [8.0 - 11.2]',
  '2007': '9.6 [8.1 - 11.3]',
  '2008': '9.6 [8.1 - 11.3]',
  '2009': '9.6 [8.1 - 11.2]',
  '2010': '9.4 [8.0 - 10.9]',
  '2011': '9.4 [7.8 - 11.0]',
  '2012': '9.4 [7.8 - 11.0]',
  '2013': '9.4 [7.7 - 11.0]',
  '2014': '9.4 [7.9 - 11.2]',
  '2015': '9.4 [7.8 - 11.1]',
  '2016': '9.3 [7.8 - 11.0]',
  '2017': '9.1 [7.5 - 10.7]',
  '2018': '8.9 [7.4 - 10.6]',
  '2019': '8.7 [7.3 - 10.4]',
  '2020': '8.5 [7.0 - 10.0]',
  '2021': '8.4 [6.8 - 10.0]',
  '2022': '8.3 [6.9 - 9.7]',
  '2023': '8.3 [6.7 - 9.8]',
  '2024': '8.3 [6.7 - 9.8]',
};
const WHO_SAME_AS: Record<string, string> = { '2000': '2001', '2024': '2023' };

function whoNotes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [year, shown] of Object.entries(WHO_SHOWN)) {
    const same = WHO_SAME_AS[year];
    out[year] =
      `WHO GHO table SA_0000001688 · Republic of Korea · Both sexes · 3-year average · value and link only · GHO displayed value "${shown}"` +
      (same ? ` · same raw value as ${same}` : '');
  }
  return out;
}

function sameNote(years: string[], note: string): Record<string, string> {
  return Object.fromEntries(years.map((y) => [y, note]));
}

const KNHANES_YEARS = [
  '2015', '2016', '2017', '2018', '2019',
  '2020', '2021', '2022', '2023', '2024',
];

const KCGP_2018_ANNEX =
  'Center press release 2021-03-11, Annex 2 "[Past 3 months] Gambling problem level among all enrolled youth"';

function kcgpLevelNotes(cagi: 'Red' | 'Yellow'): Record<string, string> {
  return {
    '2015': `Sample: middle school year 1 to high school year 2 students (N=14,011) · past 3 months · CAGI ${cagi} — compare waves with caution · "2015 Youth Gambling Problem Survey" PDF p.41 (printed p.27) Figure III-1`,
    '2018': `Sample: middle school year 1 to high school year 2 students · past 3 months · CAGI ${cagi} — compare waves with caution · ${KCGP_2018_ANNEX}: "2018 93.6 4.9 1.5"`,
    '2020': `Sample: middle school year 1 to high school year 3 students (N=15,349 · high school year 3 included for the first time) · past 3 months · CAGI ${cagi} · COVID-19 — compare with caution · ${KCGP_2018_ANNEX}: "2020 97.5 1.7 0.7"`,
  };
}

const UNODC_PREFIX = 'World · aged 15–64 · past-year use · ';
const NIA_PREFIX = 'Smartphone users aged 3–69 · high-risk + potential-risk · ';
const MSIT = 'MSIT press release';

/** 관측치 단서: 지표 code → 기간 → 영어 (seed 가 단서를 남긴 관측치만) */
export const OBSERVATION_NOTE_EN: Record<string, Record<string, string>> = {
  who_alcohol_per_capita_kr: whoNotes(),
  spo_drug_offenders_total: {
    '2015':
      'p.1 · SPO press release "2015 Drug Crime White Paper published" 2016-08-22 (PDF p.1): "Drug offenders reached a record 11,916, up 19.4% from 2014 (9,984)"',
    '2016':
      'p.1 · SPO 2016 White Paper press release 2017-09-04 (PDF p.1): "In 2016 drug offenders reached a record 14,214, up 19.3% from 2015 (11,916)"',
    '2017':
      'p.1 · SPO 2017 White Paper press release 2018-08-28 (PDF p.1): "In 2017 drug offenders numbered 14,123, above 14,000 for the second year running"',
    '2018':
      'p.1 · SPO 2018 White Paper press release 2019-09-09 (PDF p.1): "In 2018 drug offenders numbered 12,613, down 10.7% from the previous year (14,123)"',
    '2019':
      'p.1 · SPO 2019 White Paper press release 2020-05-31 (PDF p.1): "In 2019 drug offenders reached a record 16,044, up 27.2% from the previous year (12,613)"',
    '2020':
      'p.1 · SPO 2020 White Paper press release 2021-06-09 (PDF p.1): "In 2020 drug offenders reached a record 18,050, up 12.5% from the previous year (16,044)"',
    '2021':
      'p.1 · SPO 2021 White Paper press release 2022-05-06 (PDF p.1): "In 2021 drug offenders numbered 16,153, down 10.5% from the previous year"',
    '2022':
      'p.2 · SPO 2022 White Paper press release 2023-07 (PDF p.2): "Drug offenders surged 45.8%, from 12,613 in 2018 to 18,395 in 2022"',
    '2023':
      'p.4 · SPO 2023 White Paper press release 2024-06 (PDF p.4): "(All drug offenders) 27,611 in 2023, above 20,000 for the first time" · korea.kr 2024-11-18 "27,611"',
    '2024':
      'p.1 · SPO 2024 White Paper press release 2025-06-15 (PDF p.1): "In 2024 drug offenders apprehended numbered 23,022, down 16.6% from the previous year (27,611)"',
    '2025':
      'p.1 · SPO 2025 White Paper press release 2026-07-28 (PDF p.1): "In 2025 drug offenders apprehended numbered 23,403, up 1.7% from the previous year (23,022)" · korea.kr 2026-06-02 "23,403"',
  },
  knhanes_high_risk_drinking_rate: sameNote(
    KNHANES_YEARS,
    'KOSIS table DT_11702_N018 · aged 19 and over (standardized) · rate (%)',
  ),
  knhanes_current_smoking_rate: sameNote(
    KNHANES_YEARS,
    'e-Nara Indicators table 277103 "Current smoking rate" · total · age-standardized (%)',
  ),
  unodc_global_drug_users: {
    '2017': `${UNODC_PREFIX}p.11 · WDR 2019 Booklet 2 printed p.9 "In 2017, an estimated 271 million people worldwide aged 15-64 had used drugs at least once in the previous year (range: 201 million to 341 million)"`,
    '2018': `${UNODC_PREFIX}p.12 · WDR 2020 Booklet 2 printed p.10 "In 2018, an estimated 269 million people worldwide had used drugs at least once in the previous year (range: 166 million to 373 million)"`,
    '2019': `${UNODC_PREFIX}p.19 · WDR 2021 Booklet 2 printed p.19 "In 2019, an estimated 275 million people worldwide aged 15-64 … (range: 175 million to 374 million)"`,
    '2020': `${UNODC_PREFIX}p.15 · WDR 2022 Booklet 2 printed p.15 "In 2020, an estimated 284a million people worldwide aged 15-64 … had used a drug within the last 12 months" footnote "a 185-384 million"`,
    '2021': `${UNODC_PREFIX}p.12 · WDR 2023 Executive Summary printed p.12 "The estimated number of users grew from 240 million in 2011 to 296 million in 2021" · no range given`,
    '2022': `${UNODC_PREFIX}p.44 · WDR 2024 Key findings "the global estimate of people who used a drug in the past year at 292 million (or 5.6 per cent of the population aged 15 to 64) in 2022" · no range given`,
    '2023': `${UNODC_PREFIX}p.48 · WDR 2025 Key findings "In 2023, the global number of people who used a drug in the past year was estimated at 316 million people" · no range given`,
    '2024': `${UNODC_PREFIX}p.70 · WDR 2026 Highlights printed p.70 "In 2024, 331 million people were estimated to have used a drug in the past year, or 6.2 per cent of the global population aged between 15 and 64"`,
  },
  kcgp_youth_gambling_problem_group_rate: kcgpLevelNotes('Red'),
  kcgp_youth_gambling_atrisk_rate: kcgpLevelNotes('Yellow'),
  kcgp_youth_gambling_problem_rate: {
    '2015':
      'Sample: middle school year 1 to high school year 2 students · past 3 months · CAGI — compare waves with caution · NGCC press release 2019-01-10 (post 9695) "6.4%, up 1.3%p from 5.1% in 2015"',
    '2018':
      'Sample: middle school year 1 to high school year 2 students · past 3 months · CAGI — compare waves with caution · NGCC press release 2019-01-10 (post 9695) "share of the risk group … 6.4%"',
    '2020':
      'Sample: middle school year 1 to high school year 3 students (N=15,349 · high school year 3 included for the first time) · past 3 months · CAGI · online and by mail (COVID-19) — report: "use caution in direct comparison with previous years" · Center press release 2021-03-11 (7 pages · HWP), first paragraph "2.4% of 15,349 (at-risk 1.7%, 263 students + problem 0.7%, 114 students)"',
  },
  kcgp_youth_v2: {
    '2024':
      'Not comparable with 2022 or earlier · 13,368 student respondents, elementary grade 4 to high school year 3 (population 3,936,614) · lifetime · p.23 · "2024 Youth Gambling Survey" (2025-02 · PDF p.45) Table 2-1 total "(13,368) 4.3" · "4.3% of youth have gambled at least once in their lifetime"',
    '2025':
      'Not comparable with 2022 or earlier · 13,481 student respondents, elementary grade 4 to high school year 3 (population 3,941,153) · lifetime · p.25 · "2025 Youth Gambling Survey results report" (PDF p.47) Table 2-1 "The 2025 lifetime gambling experience rate was 4.0%, slightly down from the previous year (4.3%)"',
  },
  kocca_game_usage_rate: {
    '2016':
      'Ages 10–65, n=3,045 · use since 2015-07 · p.13 · "2016 Game User Survey report" (PDF p.31) "Of people aged 10–65 (n=3,045) … 67.9% played games"',
    '2017':
      'Ages 10–65, n=3,013 · p.11 · "2017 Game User Survey report" (PDF p.31) "70.3% played games, up 2.4%p from 67.9% in 2016"',
    '2018':
      'Ages 10–65, n=3,020 · PC platform category redefined · p.11 · "2018 Game User Survey" (PDF p.27) "67.2% played games, down 3.1%p from 70.3% the year before"',
    '2019':
      'Ages 10–65, n=3,037 · p.11 · "2019 Game User Survey" (PDF p.33) Figure 2-1 · Table 2-1 "65.7% played games, down 1.5%p from 67.2% the year before"',
    '2020':
      'Ages 10–65, n=3,084 · p.11 · "2020 Game User Survey" (PDF p.37) "70.5% played games, up 4.8%p from 65.7% the year before"',
    '2021':
      'Ages 10–65, n=3,000 · survey contractor changed · p.13 · "2021 Game User Survey" (PDF p.31) "Of all respondents (n=3,000) … 71.3% played games, up 0.8%p from the previous survey"',
    '2022':
      'Ages 10–65 (parts of the report say 10–64), n=6,000 · p.13 · "2022 Game User Survey" (PDF p.35) "Of all respondents (n=6,000) … 74.4% played games … up 3.1%p"',
    '2023':
      'Ages 10–64, n=10,000 · design-change year (face-to-face for ages 10–13 and 60–64) · p.13 · "2023 Game User Survey" (PDF p.37) "Of all respondents (n=10,000) … 62.9% played games … down 11.5%p"',
    '2024':
      'Ages 10–64 basis (survey covers 10–69 · headline 59.9) · online for ages 15+ · p.13 · "2024 Game User Survey" (PDF p.35) Table 2-1 footnote "The 2024 game usage rate for ages 10–64 is 62.8%"',
    '2025':
      'Ages 10–64 basis (survey covers 10–69 · headline 50.2) · p.15 · "2025 Game User Survey" (PDF p.41) Figure 2-1 note "The game usage rate for ages 10–64 was 62.8% in 2024 and 52.7% in 2025"',
  },
  nia_smartphone_overdependence_rate: {
    '2016': `${NIA_PREFIX}${MSIT} 2017-01-23 "The overall smartphone overdependence risk group (high-risk + potential-risk) was 17.8% (7,426 thousand people)" · NIA report printed p.28 · first year of the unified scale`,
    '2017': `${NIA_PREFIX}${MSIT} 2018-02-08 "The overall smartphone overdependence risk group (high-risk + potential-risk) was 18.6% (7,860 thousand people)" · NIA report printed p.21`,
    '2018': `${NIA_PREFIX}${MSIT} 2019-02-13 "The overdependence risk group (high-risk + potential-risk) was 19.1%, up 0.5%p from the previous year" · NIA report printed p.21`,
    '2019': `${NIA_PREFIX}${MSIT} 2020-02-20 "The share of the overdependence risk group (high-risk + potential-risk) was 20.0%, up 0.9%p from the previous year" · NIA report [Table 3-1-1] printed p.33`,
    '2020': `${NIA_PREFIX}${MSIT} 2021-03-10 "The share of the overdependence risk group (high-risk + potential-risk) was 23.3%, up 3.3%p from the previous year (20.0%)" · NIA report printed p.19`,
    '2021': `${NIA_PREFIX}p.34 · NIA "2021 Smartphone Overdependence Survey" report (PDF p.36) "The share of the smartphone overdependence risk group was 24.2%, up 0.9%p from last year"`,
    '2022': `${NIA_PREFIX}p.20 · NIA "2022 Smartphone Overdependence Survey" report (PDF p.48) "The share of the smartphone overdependence risk group was 23.6%, down 0.6%p from the previous year"`,
    '2023': `${NIA_PREFIX}${MSIT} 2024-03-28 "The share of the overdependence risk group (high-risk + potential-risk) was 23.1%, down 0.5%p from the previous year (23.6%)" · NIA report printed p.20`,
    '2024': `${NIA_PREFIX}${MSIT} 2025-03-27 "The share of the overdependence risk group (high-risk + potential-risk) was 22.9%, down 0.2%p from the previous year (23.1%)" · NIA report [Table 3-1-1] (PDF p.64)`,
    '2025': `${NIA_PREFIX}${MSIT} 2026-03-26 "The share of the overdependence risk group (potential-risk + high-risk) was 22.7%, down 0.2%p from the previous year (22.9%)" · NIA report [Table 3-1-1] printed p.38`,
  },
};
