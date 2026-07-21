/**
 * 부처 분산 지도 (M0 확정 콘텐츠 — frontend/src/pages/Home.tsx에서 이식).
 * UI 문자열이 아니라 콘텐츠 데이터이므로 메시지 번들 대신 타입 있는 상수로 관리.
 */
export interface MinistryRow {
  type: { ko: string; en: string };
  ministry: { ko: string; en: string };
  agency: { ko: string; en: string };
}

export const MINISTRY_MAP: MinistryRow[] = [
  {
    type: { ko: '알코올·마약(치료)', en: 'Alcohol & drugs (treatment)' },
    ministry: { ko: '보건복지부', en: 'Ministry of Health and Welfare' },
    agency: {
      ko: '중독관리통합지원센터 63개소',
      en: '63 Addiction Management Support Centers',
    },
  },
  {
    type: { ko: '도박', en: 'Gambling' },
    ministry: { ko: '국무총리실', en: "Prime Minister's Office" },
    agency: {
      ko: '사감위 → 한국도박문제예방치유원',
      en: 'NGCC → Korea Center on Gambling Problems',
    },
  },
  {
    type: { ko: '인터넷·스마트폰', en: 'Internet & smartphone' },
    ministry: { ko: '과학기술정보통신부', en: 'Ministry of Science and ICT' },
    agency: {
      ko: '스마트쉼센터',
      en: 'Smart Rest Centers (internet addiction counseling)',
    },
  },
  {
    type: { ko: '게임', en: 'Gaming' },
    ministry: {
      ko: '문화체육관광부',
      en: 'Ministry of Culture, Sports and Tourism',
    },
    agency: {
      ko: '게임과몰입힐링센터',
      en: 'Game Overindulgence Healing Centers',
    },
  },
  {
    type: { ko: '마약(수사)', en: 'Drugs (investigation)' },
    ministry: {
      ko: '대검·경찰·관세·해경',
      en: 'Prosecution · Police · Customs · Coast Guard',
    },
    agency: {
      ko: '마약범죄 정부합동수사본부',
      en: 'Joint Investigation HQ on Drug Crimes',
    },
  },
  {
    type: { ko: '마약(예방)', en: 'Drugs (prevention)' },
    ministry: { ko: '식품의약품안전처', en: 'Ministry of Food and Drug Safety' },
    agency: {
      ko: '한국마약퇴치운동본부',
      en: 'Korean Association Against Drug Abuse',
    },
  },
];
