// 도메인 코드 (D0~D3)
export enum DomainCode {
  D0 = 'D0', // 물질중독 (알코올, 약물)
  D1 = 'D1', // 행위중독 (도박, 게임)
  D2 = 'D2', // 디지털중독 (SNS, 스마트폰, AI)
  D3 = 'D3', // 관계/일중독
}

// 정책 축 (P1~P6)
export enum PolicyAxis {
  P1 = 'P1', // 예방/교육
  P2 = 'P2', // 조기개입
  P3 = 'P3', // 치료/재활
  P4 = 'P4', // 사회복귀
  P5 = 'P5', // 법/규제
  P6 = 'P6', // 재정/인프라
}

// 평가 라벨
export enum AssessmentLabel {
  STRONG = 'strong',
  MODERATE = 'moderate',
  WEAK = 'weak',
  UNCLEAR = 'unclear',
}

// 지역 코드
export enum RegionCode {
  KR = 'KR',
  US = 'US',
  EU = 'EU',
  JP = 'JP',
  CN = 'CN',
  OTHER = 'OTHER',
}

// 회복자원 유형
export enum ResourceType {
  COUNSELING = 'counseling',
  SELF_HELP = 'self_help',
  HOTLINE = 'hotline',
  HOSPITAL = 'hospital',
  SHELTER = 'shelter',
  OTHER = 'other',
}

// 태그 유형
export enum TagType {
  TOPIC = 'topic',
  POLICY = 'policy',
  REGION = 'region',
}