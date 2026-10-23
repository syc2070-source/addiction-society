/**
 * 방송 영어 이름 정본 (SOC-R12 ■2) — 중독뉴스 backend/data/broadcast_youtube_rss.json 의
 * program → program_en 그대로(NEWS-Q12 판정 ④ · 10-23 origin/main 17d84d3 실측 9/9).
 *
 * broadcast_items.source_en 채움 순서: 중독뉴스가 주는 sourceEn(export 가 열리면) → 이 표.
 * 앞단 표(frontend-next/src/lib/broadcastNamesEn.ts)의 「방송사 + 프로그램」이 이 값과 같은지
 * 시험(broadcast-names.spec)이 잰다. 중독뉴스가 이름을 바꾸면(NEWS-Q13) 이 표를 그 값으로 맞춘다.
 */
export const BROADCAST_SOURCE_EN: Readonly<Record<string, string>> = {
  'MBC PD수첩': 'MBC PD Notebook',
  'MBC 스트레이트': 'MBC Straight',
  'SBS 그것이 알고 싶다': 'SBS Unanswered Questions',
  'SBS 스페셜': 'SBS Special',
  'KBS 추적60분': 'KBS In-Depth 60 Minutes',
  'KBS 시사기획 창': 'KBS Current Affairs Window',
  'KBS 다큐인사이트': 'KBS Docu Insight',
  'EBS 다큐프라임': 'EBS Docuprime',
  뉴스타파: 'Newstapa',
};
