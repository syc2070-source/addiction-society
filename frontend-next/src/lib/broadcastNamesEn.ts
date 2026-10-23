/**
 * 방송사·프로그램 영어 이름 표 (SOC-R11 ■3 · SOC-R13 ■1 정본) — 설정 파일.
 *
 * 중독뉴스 방송 채널 9(addicted-news backend/data/broadcast_youtube_rss.json · program 칸)을
 * 그대로 열쇠로 쓴다. 중독뉴스 응답의 source = 그 program 이름이라 연대기 broadcaster 와 같다.
 * 제목은 번역하지 않는다 — en 은 「programEn (Korean)」.
 * programEn — 같은 설정의 program_en 을 글자 그대로 옮긴다(정본 · 방송사가 앞에 붙음).
 *   SOC-R13 CTO 판정(10-24): 공유 채널 넷도 정본 이름 — 채널 이름으로 따로 두지 않는다.
 * nameSource — 같은 설정의 name_source(NEWS-Q13): official = 방송사·채널이 스스로 쓰는 영어 이름 ·
 *   translation = 공식 영어 표기를 못 찾아 번역한 것. 공식이라고 넘겨짚지 않는다.
 *
 * 중독뉴스 내보내기·연대기 응답의 sourceEn 이 실려 오면 그 값이 이 표보다 먼저다
 * (broadcasterLabel · broadcastTitleLabel 의 exported 인자 · 값은 같은 program_en).
 * 채널이 늘면 이 표에 한 줄 더한다 — 표에 없는 방송은 라틴 부분 · 「Korean-language programme」.
 * 뒤 표(backend/src/sources/broadcast-names.ts)와 같은지는 backend 시험이 본다.
 */
export interface BroadcastNameEn {
  /** 중독뉴스 outlet_id */
  outletId: string;
  /** 방송사 영어 이름 */
  broadcaster: string;
  /** 정본 프로그램 영어 이름 = 중독뉴스 program_en */
  programEn: string;
  nameSource: 'official' | 'translation';
}

export const BROADCAST_NAMES_EN: Record<string, BroadcastNameEn> = {
  'MBC PD수첩': {
    outletId: 'mbc_pd_note',
    broadcaster: 'MBC',
    programEn: 'MBC PD Notebook',
    nameSource: 'translation',
  },
  'MBC 스트레이트': {
    outletId: 'mbc_straight',
    broadcaster: 'MBC',
    programEn: 'MBC Straight',
    nameSource: 'translation',
  },
  'SBS 그것이 알고 싶다': {
    outletId: 'sbs_truth',
    broadcaster: 'SBS',
    programEn: 'SBS Unanswered Questions',
    nameSource: 'translation',
  },
  'SBS 스페셜': {
    outletId: 'sbs_special',
    broadcaster: 'SBS',
    programEn: 'SBS Special',
    nameSource: 'official',
  },
  'KBS 추적60분': {
    outletId: 'kbs_60min',
    broadcaster: 'KBS',
    programEn: 'KBS In-Depth 60 Minutes',
    nameSource: 'translation',
  },
  'KBS 시사기획 창': {
    outletId: 'kbs_sisa_chang',
    broadcaster: 'KBS',
    programEn: 'KBS Current Affairs Window',
    nameSource: 'translation',
  },
  'KBS 다큐인사이트': {
    outletId: 'kbs_docu_insight',
    broadcaster: 'KBS',
    programEn: 'KBS Docu Insight',
    nameSource: 'translation',
  },
  'EBS 다큐프라임': {
    outletId: 'ebs_docuprime',
    broadcaster: 'EBS',
    programEn: 'EBS Docuprime',
    nameSource: 'translation',
  },
  뉴스타파: {
    outletId: 'newstapa',
    broadcaster: 'Newstapa',
    programEn: 'Newstapa',
    nameSource: 'official',
  },
};
