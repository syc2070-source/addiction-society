/**
 * 「정책」 쪽(/policy-map) 내용 — SOC-R24 ■1 원자료 대조표에서 「맞음」 · 「다름(원자료 값)」 인 것만.
 * 강연 자료(김영호 2026)는 무엇을 어떤 차례로 보는가의 틀로만 썼다 — 장표 · 그림 · 문장 · 발표자 고유 제안 0.
 * 문장은 사실 문장만(「~이다」 「~했다」) · 평가 · 권고 0 · 수치마다 src(출처 줄 → 원자료).
 * 대조표 전체와 「못 찾음」 목록은 docs/reports/202611/SOC-R24_1112.txt.
 *
 * 칸 문턱(결정 7): 칸마다 claimed(강연 자료가 든 항목 수)와 실은 항목 수 — 절반 미만이면 칸을 싣지 않는다(lib/policyMap).
 */

export type L10n = { ko: string; en: string };
export type Area = 'alcohol' | 'drugs' | 'gambling' | 'digital' | 'common';

export interface Source {
  org: L10n;
  title: L10n;
  /** 발행 · 공포 · 보도 시점(화면의 출처 줄) */
  date: string;
  url: string;
}

const law = (name: string) => `https://www.law.go.kr/법령/${name}`;

export const SOURCES = {
  // ── 법령(국가법령정보센터 · 현행) ──
  lawMentalHealth: {
    org: { ko: '국가법령정보센터', en: 'Korea Law Information Center' },
    title: { ko: '정신건강증진 및 정신질환자 복지서비스 지원에 관한 법률', en: 'Mental Health Welfare Act' },
    date: '현행',
    url: law('정신건강증진및정신질환자복지서비스지원에관한법률'),
  },
  lawHealthPromotion: {
    org: { ko: '국가법령정보센터', en: 'Korea Law Information Center' },
    title: { ko: '국민건강증진법', en: 'National Health Promotion Act' },
    date: '현행',
    url: law('국민건강증진법'),
  },
  lawNarcotics: {
    org: { ko: '국가법령정보센터', en: 'Korea Law Information Center' },
    title: { ko: '마약류 관리에 관한 법률', en: 'Narcotics Control Act' },
    date: '현행',
    url: law('마약류관리에관한법률'),
  },
  lawNgcc: {
    org: { ko: '국가법령정보센터', en: 'Korea Law Information Center' },
    title: { ko: '사행산업통합감독위원회법', en: 'National Gambling Control Commission Act' },
    date: '현행',
    url: law('사행산업통합감독위원회법'),
  },
  lawIntelligentInfo: {
    org: { ko: '국가법령정보센터', en: 'Korea Law Information Center' },
    title: { ko: '지능정보화 기본법', en: 'Framework Act on Intelligent Informatization' },
    date: '현행',
    url: law('지능정보화기본법'),
  },
  // ── 정부 보도자료 · 현황 ──
  mohwCenters: {
    org: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    title: { ko: '중독관리통합지원센터 운영 및 현황', en: 'Addiction Management Support Centers: operation and list' },
    date: '2026.3',
    url: 'https://www.mohw.go.kr/menu.es?mid=a10706040400',
  },
  mohw20250306: {
    org: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    title: { ko: '보도자료(마약류 중독 재활 지원 확대)', en: 'Press release (drug addiction rehabilitation support)' },
    date: '2025.3.6',
    url: 'https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1484907&mid=a10503000000',
  },
  mohw20241107: {
    org: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    title: { ko: '사실은 이렇습니다(마약류 치료보호)', en: 'Fact check (drug treatment-protection)' },
    date: '2024.11.7',
    url: 'https://m.korea.kr/briefing/actuallyView.do?newsId=148935999',
  },
  moj20240415: {
    org: { ko: '법무부 등 관계부처', en: 'Ministry of Justice and partner ministries' },
    title: { ko: '보도자료(사법-치료-재활 연계모델 전국 확대)', en: 'Press release (justice–treatment–rehabilitation model nationwide)' },
    date: '2024.4.15',
    url: 'https://www.moj.go.kr/bbs/moj/182/582178/artclView.do',
  },
  opm20250122: {
    org: { ko: '국무조정실(정책브리핑)', en: 'Office for Government Policy Coordination (korea.kr)' },
    title: { ko: '제1차 마약류 관리 기본계획(2025~2029)', en: '1st Basic Plan for Narcotics Control (2025–2029)' },
    date: '2025.1.22',
    url: 'https://korea.kr/news/policyNewsView.do?newsId=148938938',
  },
  spo20251121: {
    org: { ko: '대검찰청', en: "Supreme Prosecutors' Office" },
    title: { ko: '마약범죄 정부합동수사본부 출범', en: 'Launch of the Joint Investigation HQ on Drug Crimes' },
    date: '2025.11.21',
    url: 'https://www.spo.go.kr/site/spo/ex/board/View.do?cbIdx=1403&bcIdx=1091790',
  },
  mohw20260327: {
    org: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    title: { ko: '제3차 정신건강복지기본계획(2026~2030)', en: '3rd Basic Plan for Mental Health and Welfare (2026–2030)' },
    date: '2026.3.27',
    url: 'https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1489864&mid=a10503000000',
  },
  moe20260507: {
    org: { ko: '교육부(KDI 경제정보센터 게시)', en: 'Ministry of Education (posted by KDI EIEC)' },
    title: { ko: '보도자료(학교 도박 예방교육 연 2회 이상)', en: 'Press release (school gambling-prevention education twice a year)' },
    date: '2026.5.7',
    url: 'https://eiec.kdi.re.kr/policy/materialView.do?num=280710',
  },
  mohw20260508: {
    org: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    title: { ko: '보도자료(주류 용기 경고그림)', en: 'Press release (warning pictures on alcohol containers)' },
    date: '2026.5.8',
    url: 'https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1490454&mid=a10503010100',
  },
  mohw20260904: {
    org: { ko: '보건복지부(KDI 경제정보센터 게시)', en: 'Ministry of Health and Welfare (posted by KDI EIEC)' },
    title: { ko: '2027년 예산안 보도자료', en: '2027 budget proposal press release' },
    date: '2026.9.4',
    url: 'https://eiec.kdi.re.kr/policy/materialView.do?num=286351',
  },
  ncmhSurvey2021: {
    org: { ko: '보건복지부 · 국립정신건강센터', en: 'Ministry of Health and Welfare · National Center for Mental Health' },
    title: { ko: '2021년 정신건강실태조사', en: 'National Mental Health Survey 2021' },
    date: '2021',
    url: 'https://mhs.ncmh.go.kr/menu.es?mid=a10501070000',
  },
  mohw20231229: {
    org: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    title: { ko: '보도자료(제5기 전문병원 지정)', en: 'Press release (5th-cycle specialty hospital designation)' },
    date: '2023.12.29',
    url: 'https://mohw.go.kr/board.es?act=view&bid=0027&cg_code=&list_no=1479596&mid=a10503010100&tag=',
  },
  // ── 다른 나라 ──
  usPama2014: {
    org: { ko: '미국 연방의회', en: 'US Congress' },
    title: { ko: 'Protecting Access to Medicare Act of 2014, 제223조', en: 'Protecting Access to Medicare Act of 2014, Sec. 223' },
    date: '2014.4.1',
    url: 'https://www.govinfo.gov/content/pkg/PLAW-113publ93/html/PLAW-113publ93.htm',
  },
  usBrown2023: {
    org: { ko: 'Psychiatric Services', en: 'Psychiatric Services' },
    title: { ko: 'Brown 외, CCBHC 시범사업의 응급실 방문 · 입원 효과', en: 'Brown et al., Impacts of the CCBHC Demonstration on ED Visits and Hospitalizations' },
    date: '2023',
    url: 'https://doi.org/10.1176/appi.ps.20220410',
  },
  caOntario2020: {
    org: { ko: '캐나다 온타리오주 보건부', en: 'Ontario Ministry of Health' },
    title: { ko: 'Roadmap to Wellness', en: 'Roadmap to Wellness' },
    date: '2020.3.3',
    url: 'https://www.ontario.ca/page/roadmap-wellness-plan-build-ontarios-mental-health-and-addictions-system',
  },
  caOntario2019: {
    org: { ko: '캐나다 온타리오주', en: 'Government of Ontario' },
    title: { ko: 'Mental Health and Addictions Centre of Excellence Act, 2019', en: 'Mental Health and Addictions Centre of Excellence Act, 2019' },
    date: '2019.12',
    url: 'https://www.ontario.ca/laws/statute/19m17',
  },
  auWa2015: {
    org: { ko: '호주 서호주 주정부', en: 'Government of Western Australia' },
    title: { ko: '장관 발표(약물 · 정신건강 기관 통합)', en: 'Media statement: Agency to tackle drug issues and mental health' },
    date: '2015.7.1',
    url: 'https://www.wa.gov.au/government/media-statements/Barnett%20Liberal%20National%20Government/Agency-to-tackle-drug-issues-and-mental-health-20150701',
  },
  ukPhe2017: {
    org: { ko: '잉글랜드 공중보건청(PHE)', en: 'Public Health England' },
    title: { ko: '정신건강 · 알코올 · 약물 문제 동반자 서비스 지침', en: 'Better care for people with co-occurring mental health, and alcohol and drug use conditions' },
    date: '2017.7.26',
    url: 'https://www.gov.uk/government/publications/people-with-co-occurring-conditions-commission-and-provide-services',
  },
  ukDhsc2025: {
    org: { ko: '영국 보건사회복지부 · NHS England', en: 'DHSC · NHS England' },
    title: { ko: '정신건강 · 물질사용 동반 문제 전달 틀', en: 'Co-occurring mental health and substance use: delivery framework' },
    date: '2025.12.10',
    url: 'https://www.gov.uk/government/publications/co-occurring-mental-health-and-substance-use-delivery-framework',
  },
  ukLevy2025: {
    org: { ko: '영국 정부', en: 'UK Government' },
    title: { ko: '도박 법정 부담금', en: 'Statutory gambling levy' },
    date: '2025.12.18',
    url: 'https://www.gov.uk/government/publications/statutory-gambling-levy',
  },
  deBavaria2019: {
    org: { ko: '독일 바이에른주 의회', en: 'Bavarian Landtag' },
    title: { ko: '의회 문서 18/2752(보건부 답변)', en: 'Drucksache 18/2752 (health ministry answer)' },
    date: '2019.6.27',
    url: 'https://www.bayern.landtag.de/www/ElanTextAblage_WP18/Drucksachen/Basisdrucksachen/0000002000/0000002120_061.pdf',
  },
  // ── 연구 ──
  unodcWho2018: {
    org: { ko: 'UNODC · WHO', en: 'UNODC · WHO' },
    title: { ko: '약물 사용 예방 국제 표준(2판)', en: 'International Standards on Drug Use Prevention, 2nd ed.' },
    date: '2018',
    url: 'https://www.unodc.org/documents/prevention/UNODC-WHO_2018_prevention_standards_E.pdf',
  },
  unodc2013: {
    org: { ko: 'UNODC', en: 'UNODC' },
    title: { ko: '약물 사용 예방 국제 표준(1판 · 2015 재발행본)', en: 'International Standards on Drug Use Prevention, 1st ed. (2015 reissue)' },
    date: '2013',
    url: 'https://www.unodc.org/documents/prevention/UNODC_2013_2015_international_standards_on_drug_use_prevention_E.pdf',
  },
  vanderplasschen2019: {
    org: { ko: 'Frontiers in Psychiatry', en: 'Frontiers in Psychiatry' },
    title: { ko: 'Vanderplasschen 외, 사례관리 모형별 효과 메타분석', en: 'Vanderplasschen et al., case management models: meta-analysis' },
    date: '2019',
    url: 'https://doi.org/10.3389/fpsyt.2019.00186',
  },
  hughes2017: {
    org: { ko: 'Lancet Public Health', en: 'Lancet Public Health' },
    title: { ko: 'Hughes 외, 아동기 부정적 경험의 건강 영향 메타분석', en: 'Hughes et al., effect of multiple adverse childhood experiences on health' },
    date: '2017',
    url: 'https://doi.org/10.1016/S2468-2667(17)30118-4',
  },
  hawkins1992: {
    org: { ko: 'Psychological Bulletin', en: 'Psychological Bulletin' },
    title: { ko: 'Hawkins · Catalano · Miller, 위험 · 보호 요인', en: 'Hawkins, Catalano & Miller, risk and protective factors' },
    date: '1992',
    url: 'https://doi.org/10.1037/0033-2909.112.1.64',
  },
  // ── ① 얼마나 — 국가 조사 · 백서 ──
  kostatSdg2026: {
    org: { ko: '국가통계 연구기관(옛 통계청 통계개발원) · 질병관리청 국민건강영양조사 인용', en: 'National statistics research institute (formerly Statistics Korea SRI) · citing KDCA KNHANES' },
    title: { ko: '한국의 SDG 이행보고서 2026, 36쪽(PDF 38쪽)', en: 'Korea SDG Progress Report 2026, p.36 (PDF p.38)' },
    date: '2026.3',
    url: 'https://www.index.go.kr/upload/files/SDGsInfoRoom/SDGS/202603/20260330120330214.pdf',
  },
  ngcc2024: {
    org: { ko: '사행산업통합감독위원회', en: 'National Gambling Control Commission' },
    title: { ko: '2024년 사행산업 이용실태 조사, 그림 3-1', en: '2024 Gambling Industry Usage Survey, Fig. 3-1' },
    date: '2024.12',
    url: 'https://www.ngcc.go.kr/Download/Download.do?disposition=down&fileName=4076320250211155901.pdf&basePath=pds',
  },
  ngccIllegal2025: {
    org: { ko: '사행산업통합감독위원회', en: 'National Gambling Control Commission' },
    title: { ko: '제6차 불법도박 실태조사, 표 5-4-4', en: '6th Illegal Gambling Survey, Table 5-4-4' },
    date: '2025.12',
    url: 'https://www.ngcc.go.kr/Download/Download.do?disposition=down&fileName=1384520260119141357.pdf&basePath=pds',
  },
  msit20260326: {
    org: { ko: '과학기술정보통신부(KDI 경제정보센터 게시)', en: 'Ministry of Science and ICT (posted by KDI EIEC)' },
    title: { ko: '2025년 스마트폰 과의존 실태조사 결과 보도자료, 4쪽', en: '2025 Smartphone Overdependence Survey press release, p.4' },
    date: '2026.3.26',
    url: 'https://eiec.kdi.re.kr/policy/materialView.do?num=278528',
  },
  spoWhitePaper2025: {
    org: { ko: '공소청(옛 대검찰청)', en: "Public Prosecution Service (formerly Supreme Prosecutors' Office)" },
    title: { ko: '2025 마약류 범죄백서, 3장 표 3-1 · 3-4 · 3-6', en: '2025 Drug Crime White Paper, ch.3 Tables 3-1, 3-4, 3-6' },
    date: '2026.7',
    url: 'https://spo.go.kr/site/spo/ex/board/View.do?cbIdx=1204&bcIdx=1108709',
  },
  kcgp2024: {
    org: { ko: '한국도박문제예방치유원', en: 'Korea Center on Gambling Problems' },
    title: { ko: '2024 청소년 도박 실태조사 보고서, 그림 3-1', en: '2024 Youth Gambling Survey report, Fig. 3-1' },
    date: '2025.2',
    url: 'https://www.kcgp.or.kr/portal/bbs/B0000063/view.do?nttId=315267&menuNo=200240',
  },
  mogef20240328: {
    org: { ko: '여성가족부(한국도박문제예방치유원 조사 인용)', en: 'Ministry of Gender Equality and Family (citing KCGP survey)' },
    title: { ko: '보도자료(청소년 미디어 이용습관 점검)', en: 'Press release (youth media habits)' },
    date: '2024.3.28',
    url: 'https://www.mogef.go.kr/nw/enw/nw_enw_s001d.do?mid=mda700&bbtSn=711847',
  },
  kdcaYhs2024: {
    org: { ko: '질병관리청', en: 'Korea Disease Control and Prevention Agency' },
    title: { ko: '제20차(2024년) 청소년건강행태조사 통계, 결과표 13', en: '20th (2024) Youth Health Behavior Survey statistics, Table 13' },
    date: '2024.12',
    url: 'https://kdca.go.kr/yhs/yhshmpg/result/yhsresult/statsBookList.do',
  },
} satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

/** 칸 하나의 글 + 출처(여럿 가능) */
export interface Cell {
  text: L10n;
  src: SourceId[];
}

// ─────────────────────────────── ② 누가 맡고 있나 — 네 줄 ───────────────────────────────

export const AREAS4 = ['alcohol', 'drugs', 'gambling', 'digital'] as const;
export type Area4 = (typeof AREAS4)[number];

export interface LayerRow {
  key: 'law' | 'survey' | 'delivery' | 'funding';
  cells: Record<Area4, Cell | null>;
  /** 「그래서」 한 줄 — 표에서 센 것만 */
  so: L10n;
}

/** 강연 자료가 든 항목 4줄(법률 · 국가 조사 · 전달체계 · 재원) × 영역 4 = 16칸 — 재원 · 디지털 1칸만 「못 찾음」 */
export const LAYERS_CLAIMED = 16;

export const MINISTRIES: Record<Area4, L10n> = {
  alcohol: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
  drugs: {
    ko: '식품의약품안전처 · 보건복지부(치료) · 법무부 · 검찰 · 경찰 등(수사)',
    en: 'Ministry of Food and Drug Safety · Ministry of Health and Welfare (treatment) · Justice and prosecution (investigation)',
  },
  gambling: { ko: '사행산업통합감독위원회(국무총리 소속)', en: "National Gambling Control Commission (under the Prime Minister)" },
  digital: { ko: '과학기술정보통신부', en: 'Ministry of Science and ICT' },
};

export const LAYERS: LayerRow[] = [
  {
    key: 'law',
    cells: {
      alcohol: {
        text: {
          ko: '정신건강복지법(중독관리통합지원센터 제15조의3) · 국민건강증진법(주류 용기 경고 제8조)',
          en: 'Mental Health Welfare Act (centers, Art. 15-3) · National Health Promotion Act (container warnings, Art. 8)',
        },
        src: ['lawMentalHealth', 'lawHealthPromotion'],
      },
      drugs: {
        text: {
          ko: '마약류 관리에 관한 법률(치료보호 제40조 · 한국마약퇴치운동본부 제51조의6)',
          en: 'Narcotics Control Act (treatment-protection Art. 40 · Korean Association Against Drug Abuse Art. 51-6)',
        },
        src: ['lawNarcotics'],
      },
      gambling: {
        text: {
          ko: '사행산업통합감독위원회법(위원회 제4조 · 한국도박문제예방치유원 제14조)',
          en: 'NGCC Act (commission Art. 4 · Korea Center on Gambling Problems Art. 14)',
        },
        src: ['lawNgcc'],
      },
      digital: {
        text: {
          ko: '지능정보화 기본법(과의존 예방 · 해소 제51~54조)',
          en: 'Framework Act on Intelligent Informatization (overdependence, Arts. 51–54)',
        },
        src: ['lawIntelligentInfo'],
      },
    },
    so: {
      ko: '네 영역은 다섯 개의 법으로 나뉘어 있고, 그 법을 맡는 부처는 넷(보건복지부 · 식품의약품안전처 · 사행산업통합감독위원회 · 과학기술정보통신부)이다.',
      en: 'The four areas fall under five acts, administered by four bodies (MOHW, MFDS, NGCC, MSIT).',
    },
  },
  {
    key: 'survey',
    cells: {
      alcohol: {
        text: {
          ko: '국민건강영양조사(질병관리청) · 정신건강실태조사(보건복지부) · 청소년건강행태조사(질병관리청)',
          en: 'KNHANES (KDCA) · National Mental Health Survey (MOHW) · Youth Health Behavior Survey (KDCA)',
        },
        src: ['kostatSdg2026', 'ncmhSurvey2021', 'kdcaYhs2024'],
      },
      drugs: {
        text: {
          ko: '마약류 범죄백서(공소청 · 옛 대검찰청) — 단속 인원을 센다',
          en: 'Drug Crime White Paper (prosecution service) — counts arrests',
        },
        src: ['spoWhitePaper2025'],
      },
      gambling: {
        text: {
          ko: '사행산업 이용실태 조사 · 불법도박 실태조사(사감위) · 청소년 도박 실태조사(한국도박문제예방치유원)',
          en: 'Gambling Industry Usage Survey · Illegal Gambling Survey (NGCC) · Youth Gambling Survey (KCGP)',
        },
        src: ['ngcc2024', 'ngccIllegal2025', 'kcgp2024'],
      },
      digital: {
        text: {
          ko: '스마트폰 과의존 실태조사(과학기술정보통신부 · 한국지능정보사회진흥원)',
          en: 'Smartphone Overdependence Survey (MSIT · NIA)',
        },
        src: ['msit20260326'],
      },
    },
    so: {
      ko: '이 표의 국가 자료는 영역마다 내는 기관과 대상이 다르고, 네 영역을 한 조사에서 함께 다루는 것은 이 표에 없다. 마약류 칸의 국가 자료는 사용 실태가 아니라 단속 인원이다.',
      en: 'Each area\'s national data come from a different body and population; none of the sources in this table covers all four areas. The national figure for drugs counts arrests, not use.',
    },
  },
  {
    key: 'delivery',
    cells: {
      alcohol: {
        text: {
          ko: '중독관리통합지원센터(보건복지부 · 지방자치단체)',
          en: 'Addiction Management Support Centers (MOHW · local governments)',
        },
        src: ['lawMentalHealth', 'mohwCenters'],
      },
      drugs: {
        text: {
          ko: '치료보호기관(보건복지부 장관 또는 시 · 도지사 지정) · 한국마약퇴치운동본부(식품의약품안전처)',
          en: 'Treatment-protection institutions (designated by MOHW or provinces) · Korean Association Against Drug Abuse (MFDS)',
        },
        src: ['lawNarcotics'],
      },
      gambling: {
        text: {
          ko: '한국도박문제예방치유원(사감위)',
          en: 'Korea Center on Gambling Problems (NGCC)',
        },
        src: ['lawNgcc'],
      },
      digital: {
        text: {
          ko: '지능정보서비스 과의존 대응센터(국가 · 지방자치단체가 둘 수 있다 · 제52조)',
          en: 'Overdependence response centers (may be set up by central or local government, Art. 52)',
        },
        src: ['lawIntelligentInfo'],
      },
    },
    so: {
      ko: '전달 기관은 영역마다 따로 있고, 근거 법도 각각이다.',
      en: 'Each area has its own delivery body, set up under its own act.',
    },
  },
  {
    key: 'funding',
    cells: {
      alcohol: {
        text: {
          ko: '국민건강증진기금 — 법이 절주 교육 · 음주 폐해 예방에 쓸 수 있게 정했다(제25조)',
          en: 'National Health Promotion Fund — the act allows spending on moderation education and alcohol-harm prevention (Art. 25)',
        },
        src: ['lawHealthPromotion'],
      },
      drugs: {
        text: {
          ko: '치료보호 비용은 「예산의 범위에서」 지원(제40조) · 치료보호 환자 건강보험 적용(2024.7)',
          en: 'Treatment-protection costs are paid "within the budget" (Art. 40) · health insurance covers patients from Jul 2024',
        },
        src: ['lawNarcotics', 'mohw20241107'],
      },
      gambling: {
        text: {
          ko: '중독예방치유부담금 — 사행산업 연간 순매출액의 1만분의 35 이상 50 이하(시행령 1만분의 35) · 국민체육진흥기금 안의 별도 계정',
          en: 'Addiction prevention and treatment levy — 0.35%–0.50% of annual net gambling sales (0.35% by decree) · separate account in the National Sports Promotion Fund',
        },
        src: ['lawNgcc'],
      },
      digital: null,
    },
    so: {
      ko: '이 표의 법 가운데 업계 매출에 부담금을 매기는 것은 사행산업통합감독위원회법 하나다.',
      en: 'Of the acts in this table, only the NGCC Act charges a levy on industry sales.',
    },
  },
];

// ─────────────────────────────── ① 얼마나 ───────────────────────────────

export interface Figure {
  area: Area4;
  label: L10n;
  value: string;
  /** 값 뒤에 붙는 단위(% 는 값에 들어 있음) */
  unit: 'people' | 'age' | null;
  /** 무엇으로 쟀나(대상 · 정의 · 자료 연도) */
  measure: L10n;
  src: SourceId[];
}

/** 강연 자료가 든 수치 12(불법도박 온라인 비중 37% · 71.2% 를 둘로 셈) — 「못 찾음」 1(37%) · 「다름」 1(30대 이하 62.3% → 원자료에 찍힌 20 · 30대 59.4%) */
export const FIGURES_CLAIMED = 12;

/** 영역마다 대표 하나(넷) */
export const FIGURES: Figure[] = [
  {
    area: 'alcohol',
    label: { ko: '성인 고위험음주율', en: 'Adult high-risk drinking' },
    value: '13.8%',
    unit: null,
    measure: {
      ko: '19세 이상 · 한 번에 남 7잔(여 5잔) 이상을 주 2회 이상 · 2005년 인구로 연령표준화 · 2023년 · 국민건강영양조사',
      en: 'Adults 19+ · 7+ drinks (women 5+) per occasion at least twice a week · age-standardised to 2005 population · 2023 · KNHANES',
    },
    src: ['kostatSdg2026'],
  },
  {
    area: 'drugs',
    label: { ko: '마약류 사범 단속 인원', en: 'People arrested for drug offences' },
    value: '23,403',
    unit: 'people',
    measure: {
      ko: '모든 단속 기관이 붙잡은 사람 수(사용 실태가 아니다) · 2025년',
      en: 'People caught by all enforcement agencies (not a measure of use) · 2025',
    },
    src: ['spoWhitePaper2025'],
  },
  {
    area: 'gambling',
    label: { ko: '성인 도박문제 유병률', en: 'Adult problem-gambling prevalence' },
    value: '5.1%',
    unit: null,
    measure: {
      ko: '20세 이상 1만5천 명 · CPGI 중위험 + 문제성 · 2024년 조사(2023년 일을 물음)',
      en: '15,000 adults 20+ · CPGI moderate-risk + problem · 2024 survey (asks about 2023)',
    },
    src: ['ngcc2024'],
  },
  {
    area: 'digital',
    label: { ko: '스마트폰 과의존 위험군', en: 'Smartphone overdependence risk group' },
    value: '22.7%',
    unit: null,
    measure: {
      ko: '3~69세 스마트폰 이용자 · 1만 가구 면접 · 잠재적 위험군 + 고위험군 · 2025년',
      en: 'Smartphone users aged 3–69 · 10,000 households, face-to-face · potential + high risk · 2025',
    },
    src: ['msit20260326'],
  },
];

/** 더 보기(청소년 · 마약류 세부 · 불법도박) — 같은 원자료 대조를 거친 것만 */
export const MORE_FIGURES: Figure[] = [
  {
    area: 'digital',
    label: { ko: '청소년 스마트폰 과의존 위험군', en: 'Youth smartphone overdependence risk group' },
    value: '43.0%',
    unit: null,
    measure: { ko: '10~19세 · 2025년', en: 'Ages 10–19 · 2025' },
    src: ['msit20260326'],
  },
  {
    area: 'gambling',
    label: { ko: '도박 경험률(초4~고3)', en: 'Ever gambled (grade 4 to grade 12)' },
    value: '4.3%',
    unit: null,
    measure: { ko: '재학생 1만3,368명 · 한 번이라도 · 2024년 승인통계', en: '13,368 students · ever, at least once · 2024 approved statistic' },
    src: ['kcgp2024'],
  },
  {
    area: 'gambling',
    label: { ko: '청소년 도박 첫 시작 평균 나이', en: 'Average age at first gambling (youth)' },
    value: '11.3',
    unit: 'age',
    measure: {
      ko: '2022년 시범 조사(승인통계 전) — 2024년 승인통계(12.9세)와 설계가 달라 이어 보지 않는다',
      en: '2022 pilot round (before approval) — different design from the 2024 approved survey (12.9), not a trend',
    },
    src: ['mogef20240328', 'kcgp2024'],
  },
  {
    area: 'gambling',
    label: { ko: '불법도박 매출 가운데 온라인 몫', en: 'Online share of illegal-gambling turnover' },
    value: '71.2%',
    unit: null,
    measure: {
      ko: '추정 총매출 95.8조 원 가운데 온라인 68.2조 원 · 2024.9~2025.8 · 이용자 비율이 아니다',
      en: 'KRW 68.2 trillion online of an estimated 95.8 trillion · Sep 2024–Aug 2025 · not a share of users',
    },
    src: ['ngccIllegal2025'],
  },
  {
    area: 'alcohol',
    label: { ko: '청소년 첫 음주 평균 나이', en: 'Average age at first drink (youth)' },
    value: '13.0',
    unit: 'age',
    measure: { ko: '중1~고3 가운데 술을 마셔 본 학생 · 첫 한 잔 · 2024년', en: 'Students grade 7–12 who have drunk · first full glass · 2024' },
    src: ['kdcaYhs2024'],
  },
  {
    area: 'drugs',
    label: { ko: '마약류 사범 가운데 20 · 30대', en: 'Drug offenders in their 20s and 30s' },
    value: '59.4%',
    unit: null,
    measure: { ko: '2025년 단속 인원 기준(백서에 찍힌 값)', en: 'Share of 2025 arrests (as printed in the white paper)' },
    src: ['spoWhitePaper2025'],
  },
  {
    area: 'drugs',
    label: { ko: '마약류 밀수 사범', en: 'People arrested for drug smuggling' },
    value: '1,772',
    unit: 'people',
    measure: { ko: '2025년 · 전년 1,126명', en: '2025 · 1,126 the year before' },
    src: ['spoWhitePaper2025'],
  },
];

// ─────────────────────────────── ③ 무엇이 바뀌었나 — 2022년 이후 ───────────────────────────────

export interface TimelineItem {
  /** 'YYYY.M' 또는 'YYYY' */
  date: string;
  area: Area;
  text: L10n;
  src: SourceId[];
  planned?: boolean;
}

/** 강연 자료가 든 항목 10 — 「못 찾음」 1(2022 청년중독관리사업 시작 연도) · 「다름」 1(센터 50 → 58곳 → 원자료 60곳 + 2025년 3곳) */
export const TIMELINE_CLAIMED = 10;

export const TIMELINE: TimelineItem[] = [
  {
    date: '2024.4',
    area: 'drugs',
    text: {
      ko: '마약류 사범을 수사 · 재판 단계에서 치료 · 재활로 잇는 「사법-치료-재활 연계모델」을 전국으로 넓혔다(2023년 시범 뒤).',
      en: 'The justice–treatment–rehabilitation model, which refers drug offenders to treatment and rehabilitation during investigation and trial, was extended nationwide after a 2023 pilot.',
    },
    src: ['moj20240415'],
  },
  {
    date: '2024.7',
    area: 'drugs',
    text: {
      ko: '마약류 치료보호 환자에게 건강보험을 적용하고, 본인 부담은 예산으로 지원하기 시작했다.',
      en: 'Health insurance began to cover drug treatment-protection patients, with the patient share paid from the budget.',
    },
    src: ['mohw20241107'],
  },
  {
    date: '2025.1',
    area: 'drugs',
    text: {
      ko: '정부가 제1차 마약류 관리 기본계획(2025~2029)을 발표했다.',
      en: 'The government announced the 1st Basic Plan for Narcotics Control (2025–2029).',
    },
    src: ['opm20250122'],
  },
  {
    date: '2025.3',
    area: 'common',
    text: {
      ko: '중독관리통합지원센터는 60곳이고, 2025년에 3곳(서울 강남구 · 경기 용인시 · 경북 안동시)을 더 둔다고 밝혔다.',
      en: 'There were 60 Addiction Management Support Centers; the ministry announced 3 more in 2025 (Gangnam-gu Seoul, Yongin Gyeonggi, Andong Gyeongbuk).',
    },
    src: ['mohw20250306'],
  },
  {
    date: '2025.11',
    area: 'drugs',
    text: {
      ko: '마약범죄 정부합동수사본부가 출범했다.',
      en: 'The Joint Investigation Headquarters on Drug Crimes was launched.',
    },
    src: ['spo20251121'],
  },
  {
    date: '2026.3',
    area: 'common',
    text: {
      ko: '제3차 정신건강복지기본계획(2026~2030)을 확정했다. 마약류 치료보호기관을 기존 9곳에서 18곳으로 늘리는 내용이 들어 있다(셈 기준은 보도자료에 없음).',
      en: 'The 3rd Basic Plan for Mental Health and Welfare (2026–2030) was adopted; it includes expanding drug treatment-protection institutions from 9 to 18 (the release does not say how they are counted).',
    },
    src: ['mohw20260327'],
  },
  {
    date: '2026.5',
    area: 'gambling',
    text: {
      ko: '학교의 도박 예방교육이 연 2회 이상 의무가 되었다(사행산업통합감독위원회법 제18조의4).',
      en: 'Schools became required to provide gambling-prevention education at least twice a year (NGCC Act, Art. 18-4).',
    },
    src: ['moe20260507', 'lawNgcc'],
  },
  {
    date: '2026.11',
    area: 'alcohol',
    text: {
      ko: '주류 용기에 경고문구와 함께 경고그림을 표시할 수 있도록 한 개정 규정이 시행되었다(국민건강증진법 제8조).',
      en: 'Amended rules allowing warning pictures alongside the warning text on alcohol containers took effect (National Health Promotion Act, Art. 8).',
    },
    src: ['mohw20260508', 'lawHealthPromotion'],
  },
  {
    date: '2027',
    area: 'drugs',
    planned: true,
    text: {
      ko: '2027년 예산안에 마약류 사범을 사법 단계마다 치료로 잇는 시범사업이 들어 있다(예정).',
      en: 'The 2027 budget proposal includes a pilot linking drug offenders to treatment at each stage of the justice process (planned).',
    },
    src: ['mohw20260904'],
  },
];

// ─────────────────────────────── ④ 어디가 비어 있나 ───────────────────────────────

export interface GapItem {
  label: L10n;
  /** null = 공개 자료 없음(이 쪽이 찾은 범위) */
  value: L10n | null;
  note?: L10n;
  src: SourceId[];
}

/** 강연 자료가 든 항목 6 — 「못 찾음」 2(치료보호 참여 10.6% · 센터 인력 333명 · 5.6명) · 「다름」 2(전문병원 발표 시점 · 상위 2곳 몫의 해와 값) */
export const GAPS_CLAIMED = 6;

export const GAPS: GapItem[] = [
  {
    label: {
      ko: '알코올 사용장애가 있는 사람 가운데 1년 동안 정신건강서비스를 이용한 비율',
      en: 'People with an alcohol use disorder who used mental health services in the past year',
    },
    value: { ko: '2.6%', en: '2.6%' },
    note: { ko: '2021년 정신건강실태조사', en: 'National Mental Health Survey 2021' },
    src: ['ncmhSurvey2021'],
  },
  {
    label: {
      ko: '마약류 중독 치료비율 가운데 인천참사랑병원 · 국립부곡병원 두 곳의 몫',
      en: 'Share of drug-addiction treatment at two hospitals (Incheon Chamsarang, National Bugok)',
    },
    value: { ko: '97%(2022) → 86%(2023) → 77%(2024년 1~9월)', en: '97% (2022) → 86% (2023) → 77% (Jan–Sep 2024)' },
    note: { ko: '치료 실적 기관은 18곳으로 확대(2024.11 발표)', en: 'Institutions with treatment cases expanded to 18 (announced Nov 2024)' },
    src: ['mohw20241107'],
  },
  {
    label: { ko: '알코올 질환 전문병원', en: 'Specialty hospitals for alcohol disorders' },
    value: { ko: '2024년 운영 8곳(제5기 지정 7곳)', en: '8 operating in 2024 (7 designated in the 5th cycle)' },
    note: { ko: '2023.12.29 지정 발표', en: 'Designation announced 29 Dec 2023' },
    src: ['mohw20231229'],
  },
  {
    label: { ko: '중독관리통합지원센터', en: 'Addiction Management Support Centers' },
    value: { ko: '60곳(2025)', en: '60 (2025)' },
    src: ['mohw20250306'],
  },
  {
    label: { ko: '마약류 투약사범의 치료보호 참여율', en: 'Treatment-protection participation of drug users charged with use' },
    value: null,
    src: [],
  },
  {
    label: { ko: '중독관리통합지원센터 상근 인력 · 센터당 인력', en: 'Full-time staff of the centers · staff per center' },
    value: null,
    src: [],
  },
];

// ─────────────────────────────── ⑤ 다른 나라는 ───────────────────────────────

export interface CountryItem {
  country: L10n;
  merged: L10n;
  basis: L10n;
  /** null = 성과 평가를 찾지 못함 */
  evaluation: L10n | null;
  src: SourceId[];
}

/** 강연 자료가 든 나라 5 — 바이에른은 「다름」(2008 = 도박 중독 주 조정 기관 · 정신건강 통합이 아님) */
export const COUNTRIES_CLAIMED = 5;

export const COUNTRIES: CountryItem[] = [
  {
    country: { ko: '미국', en: 'United States' },
    merged: {
      ko: '정신건강 · 물질사용 서비스를 한 곳에서 주는 인증 지역사회 행동건강 클리닉(CCBHC) 시범사업',
      en: 'Certified Community Behavioral Health Clinics (CCBHC) providing mental health and substance use services together',
    },
    basis: { ko: 'Protecting Access to Medicare Act of 2014 제223조', en: 'Protecting Access to Medicare Act of 2014, Sec. 223' },
    evaluation: {
      ko: '있음 — 행동건강 응급실 방문이 세 주 가운데 두 주에서 11~13% 줄었다(Brown 외 2023)',
      en: 'Yes — behavioural-health ED visits fell 11–13% in two of three states (Brown et al. 2023)',
    },
    src: ['usPama2014', 'usBrown2023'],
  },
  {
    country: { ko: '캐나다 온타리오', en: 'Canada (Ontario)' },
    merged: {
      ko: '정신건강 · 중독 체계 전체를 맡는 기구(Centre of Excellence)를 Ontario Health 안에 법으로 두었다',
      en: 'A Mental Health and Addictions Centre of Excellence within Ontario Health, set up by statute',
    },
    basis: {
      ko: 'Centre of Excellence Act(2019.12) · Roadmap to Wellness(2020.3 · 10년 38억 캐나다달러)',
      en: 'Centre of Excellence Act (Dec 2019) · Roadmap to Wellness (Mar 2020 · CAD 3.8 billion over 10 years)',
    },
    evaluation: null,
    src: ['caOntario2019', 'caOntario2020'],
  },
  {
    country: { ko: '호주 서호주', en: 'Australia (Western Australia)' },
    merged: {
      ko: '약물 · 알코올 사무국(Drug and Alcohol Office)을 정신건강위원회(Mental Health Commission)에 합쳤다',
      en: 'The Drug and Alcohol Office was merged into the Mental Health Commission',
    },
    basis: { ko: 'Alcohol and Drug Authority Amendment Act 2015(2015.7.1)', en: 'Alcohol and Drug Authority Amendment Act 2015 (1 July 2015)' },
    evaluation: null,
    src: ['auWa2015'],
  },
  {
    country: { ko: '영국', en: 'United Kingdom' },
    merged: {
      ko: '잉글랜드: 정신건강과 알코올 · 약물 문제를 함께 가진 사람의 서비스 지침(2017)과 전달 틀(2025) · 그레이트브리튼: 도박 법정 부담금(2025.4부터 · 총도박수익(GGY)의 0.1~1.1% · 치료 50 · 예방 30 · 연구 20)',
      en: 'England: guidance (2017) and a delivery framework (2025) for co-occurring mental health and substance use · Great Britain: statutory gambling levy (from Apr 2025 · 0.1–1.1% of gross gambling yield · 50% treatment, 30% prevention, 20% research)',
    },
    basis: {
      ko: 'PHE 지침(2017) · DHSC · NHS England 전달 틀(2025.12) · Gambling Levy Regulations 2025',
      en: 'PHE guidance (2017) · DHSC · NHS England delivery framework (Dec 2025) · Gambling Levy Regulations 2025',
    },
    evaluation: null,
    src: ['ukPhe2017', 'ukDhsc2025', 'ukLevy2025'],
  },
  {
    country: { ko: '독일 바이에른', en: 'Germany (Bavaria)' },
    merged: {
      ko: '도박 중독의 주 조정 기관(Landesstelle Glücksspielsucht in Bayern)을 2008년부터 해마다 약 200만 유로로 지원한다. 정신건강과 합친 기구는 아니다.',
      en: 'Since 2008 the state has funded a coordination office for gambling addiction (Landesstelle Glücksspielsucht in Bayern) at about EUR 2 million a year; it is not a merger with mental health services.',
    },
    basis: { ko: '바이에른주 의회 문서 18/2752(2019)', en: 'Bavarian Landtag Drucksache 18/2752 (2019)' },
    evaluation: null,
    src: ['deBavaria2019'],
  },
];

// ─────────────────────────────── ⑥ 연구는 무엇을 말하나 ───────────────────────────────

export interface ResearchItem {
  cite: L10n;
  text: L10n;
  src: SourceId[];
}

/** 강연 자료가 든 문헌 5 — 모두 「맞음」 */
export const RESEARCH_CLAIMED = 5;

export const RESEARCH: ResearchItem[] = [
  {
    cite: { ko: 'UNODC · WHO(2018)', en: 'UNODC · WHO (2018)' },
    text: {
      ko: '약물 사용 예방의 국제 표준 2판을 함께 냈다. 나이대 · 장소별 예방 중재와 국가 예방 체계의 근거를 정리했다.',
      en: 'Jointly published the 2nd edition of the International Standards on Drug Use Prevention, summarising evidence on prevention by age and setting and on national prevention systems.',
    },
    src: ['unodcWho2018'],
  },
  {
    cite: { ko: 'UNODC(2013)', en: 'UNODC (2013)' },
    text: {
      ko: '예방에 1달러를 쓰면 보건 · 사회 · 범죄 비용을 적어도 10달러 아낄 수 있다고 적었다(추정치 · 1판 머리말).',
      en: 'Stated that every dollar spent on prevention can save at least ten in future health, social and crime costs (an estimate · introduction to the 1st edition).',
    },
    src: ['unodc2013'],
  },
  {
    cite: { ko: 'Vanderplasschen 외(2019)', en: 'Vanderplasschen et al. (2019)' },
    text: {
      ko: '무작위대조시험 21편(7,431명)을 묶은 메타분석에서 사례관리의 효과는 전체로 작았고(SMD 0.18), 치료 유지(0.47)와 서비스 연계(0.23)에서 컸으며, 개인 기능(0.06)에서는 유의하지 않았다.',
      en: 'A meta-analysis of 21 randomised trials (7,431 participants) found a small overall effect of case management (SMD 0.18), larger for treatment retention (0.47) and linkage to services (0.23), and no significant effect on personal functioning (0.06).',
    },
    src: ['vanderplasschen2019'],
  },
  {
    cite: { ko: 'Hughes 외(2017)', en: 'Hughes et al. (2017)' },
    text: {
      ko: '연구 37편을 묶은 메타분석에서 아동기 부정적 경험이 넷 이상인 사람은 없는 사람보다 문제성 약물 사용의 오즈가 약 10배(OR 10.22), 문제성 음주가 약 6배(OR 5.84)였다.',
      en: 'A meta-analysis of 37 studies found that people with four or more adverse childhood experiences had about 10 times the odds of problematic drug use (OR 10.22) and about 6 times the odds of problematic alcohol use (OR 5.84) compared with people with none.',
    },
    src: ['hughes2017'],
  },
  {
    cite: { ko: 'Hawkins · Catalano · Miller(1992)', en: 'Hawkins, Catalano & Miller (1992)' },
    text: {
      ko: '청소년 알코올 · 약물 문제의 위험 요인과 보호 요인을 정리하고, 위험 요인에 초점을 둔 예방 접근을 제시했다.',
      en: 'Reviewed risk and protective factors for adolescent alcohol and drug problems and set out a risk-focused approach to prevention.',
    },
    src: ['hawkins1992'],
  },
];

// ─────────────────────────────── ⑦ 지역은 지금 무엇을 하나 ───────────────────────────────

export interface LocalItem {
  label: L10n;
  value: L10n | null;
  note?: L10n;
  src: SourceId[];
}

/** 강연 자료가 이 칸에 든 수치는 없다 — 지시서가 정한 항목 4(전국 센터 수 · 광역 단위 · 대전 · 인력)로 문턱을 잼 · 인력은 「못 찾음」(보고서 정직 표기) */
export const LOCAL_CLAIMED = 4;

export const LOCAL: LocalItem[] = [
  {
    label: { ko: '전국 중독관리통합지원센터(보건복지부 현황 목록)', en: 'Addiction Management Support Centers nationwide (ministry list)' },
    value: { ko: '63곳 · 16개 시 · 도', en: '63 in 16 provinces and metropolitan cities' },
    note: {
      ko: '2026.3 수정 목록 · 2025.3 보도자료의 60곳에 2025년 3곳을 더한 수와 같다',
      en: 'List updated Mar 2026 · equals the 60 in the Mar 2025 release plus 3 added in 2025',
    },
    src: ['mohwCenters', 'mohw20250306'],
  },
  {
    label: { ko: '광역 단위 센터', en: 'Province-level centers' },
    value: { ko: '6곳 — 경기 · 강원 · 충북 · 전북 · 경남 · 제주', en: '6 — Gyeonggi, Gangwon, Chungbuk, Jeonbuk, Gyeongnam, Jeju' },
    note: {
      ko: '광역 사업: 광역 중독관리사업 기획 · 기반 조성 · 운영 매뉴얼 · 콘텐츠 개발 · 협력 체계 구축',
      en: 'Province-level work: planning, infrastructure, operating manuals and partnerships',
    },
    src: ['mohwCenters'],
  },
  {
    label: { ko: '대전의 센터', en: 'Centers in Daejeon' },
    value: { ko: '5곳 — 대덕구 · 동구 · 서구 · 유성구 · 중구', en: '5 — Daedeok-gu, Dong-gu, Seo-gu, Yuseong-gu, Jung-gu' },
    note: {
      ko: '같은 쪽 위의 지역별 요약에는 「대전(4)」로 적혀 있다',
      en: 'The regional summary at the top of the same page says "Daejeon (4)"',
    },
    src: ['mohwCenters'],
  },
  {
    label: { ko: '센터 인력', en: 'Center staff' },
    value: null,
    src: [],
  },
];

// ─────────────────────────────── 참고(강연 · 틀로만) ───────────────────────────────

export const REFERENCE: L10n = {
  ko: '참고: 이 쪽은 무엇을 어떤 차례로 볼지의 틀을 김영호(을지대학교), 「변화하는 중독문제와 지역 중독정책의 방향」, 2026년 중독예방의 날 기념 정책토론회 「대전의 중독관리, 기반을 전략으로」 기조강연(2026)에서 빌렸다. 수치와 문장은 강연 자료가 아니라 각 칸의 원자료에서 확인해 새로 썼다.',
  en: 'Reference: the order of this page follows the outline of a keynote by Kim Young-ho (Eulji University), "Changing addiction problems and the direction of local addiction policy", at the 2026 Addiction Prevention Day policy forum in Daejeon (2026). Figures and text were checked against the primary sources cited in each section, not taken from the talk.',
};
