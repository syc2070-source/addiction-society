/**
 * 방송사·프로그램 영어 이름 표 (SOC-R11 ■3) — 설정 파일.
 *
 * 중독뉴스 방송 채널 9(addicted-news backend/data/broadcast_youtube_rss.json · program 칸)을
 * 그대로 열쇠로 쓴다. 중독뉴스 응답의 source = 그 program 이름이라 연대기 broadcaster 와 같다.
 * 제목은 번역하지 않는다 — en 은 「프로그램 영어 이름 (Korean)」.
 * basis — 이름의 근거(공식이라고 넘겨짚지 않는다):
 *   channel = 중독뉴스 설정의 채널 이름·handle 에 그 라틴 이름이 있다(Newstapa · mbc-straight)
 *   known   = 널리 쓰이는 영어 이름(방송사 누리집으로 이 판에 재지 않음 · 미측)
 *   meaning = 영어 이름을 찾지 못해 이름의 뜻·소리를 옮긴 것
 * channel — 중독뉴스 설정이 shared_channel 인 넷(한 채널에 여러 프로그램 · 10-22 실측: 「KBS 다큐인사이트」로 온
 *   두 편이 실제로는 「KBS 더 보다」·「KBS 취재파일」). 이 넷은 프로그램 이름 대신 채널 이름을 보인다(넘겨짚지 않음).
 *
 * 중독뉴스 내보내기에 영어 이름 칸이 생기면(NEWS-Q12 ■4) 그 값이 이 표보다 먼저다
 * (broadcasterLabel · broadcastTitleLabel 의 exported 인자).
 * 채널이 늘면 이 표에 한 줄 더한다 — 표에 없는 방송은 라틴 부분 · 「Korean-language programme」.
 */
export interface BroadcastNameEn {
  /** 중독뉴스 outlet_id */
  outletId: string;
  /** 방송사 영어 이름 */
  broadcaster: string;
  /** 프로그램 영어 이름 */
  program: string;
  basis: 'channel' | 'known' | 'meaning';
  /** 여러 프로그램이 함께 쓰는 채널이면 채널 영어 이름 — en 제목 자리에 program 대신 보인다 */
  channel?: string;
}

export const BROADCAST_NAMES_EN: Record<string, BroadcastNameEn> = {
  'MBC PD수첩': {
    outletId: 'mbc_pd_note',
    broadcaster: 'MBC',
    program: 'PD Notebook',
    basis: 'known',
  },
  'MBC 스트레이트': {
    outletId: 'mbc_straight',
    broadcaster: 'MBC',
    program: 'Straight',
    basis: 'channel',
  },
  'SBS 그것이 알고 싶다': {
    outletId: 'sbs_truth',
    broadcaster: 'SBS',
    program: 'Unanswered Questions',
    basis: 'known',
  },
  'SBS 스페셜': {
    outletId: 'sbs_special',
    broadcaster: 'SBS',
    program: 'SBS Special',
    basis: 'meaning',
    channel: 'SBS DALI channel',
  },
  'KBS 추적60분': {
    outletId: 'kbs_60min',
    broadcaster: 'KBS',
    program: 'In-Depth 60 Minutes',
    basis: 'known',
  },
  'KBS 시사기획 창': {
    outletId: 'kbs_sisa_chang',
    broadcaster: 'KBS',
    program: 'Current Affairs Window',
    basis: 'meaning',
    channel: 'KBS Current Affairs channel',
  },
  'KBS 다큐인사이트': {
    outletId: 'kbs_docu_insight',
    broadcaster: 'KBS',
    program: 'Docu Insight',
    basis: 'meaning',
    channel: 'KBS Documentary channel',
  },
  'EBS 다큐프라임': {
    outletId: 'ebs_docuprime',
    broadcaster: 'EBS',
    program: 'Docuprime',
    basis: 'meaning',
    channel: 'EBS Documentary channel',
  },
  뉴스타파: {
    outletId: 'newstapa',
    broadcaster: 'Newstapa',
    program: 'Newstapa',
    basis: 'channel',
  },
};
