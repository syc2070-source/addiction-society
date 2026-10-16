/**
 * 감시 URL 수정 (SOC-R6 ■1).
 *
 * seed:sources 는 넣기만이라 기존 출처 행의 url 을 고치지 못한다. 감시 설정(url ·
 * access_detail)만 migration 으로 바꾸고, 바꾼 사실은 source_events 에
 * source_updated{from,to,reason} 로 남긴다(원칙 11). 관측치·관리자 값은 건드리지 않는다.
 *
 * 기준선(contentHash · etag · lastModified)은 옛 주소의 것이라 비우고 lastCheckedAt 도
 * 비운다 → 다음 09:00 감시가 「첫 읽기」(DAILY_DUE_WHERE) 로 새 주소의 기준선을 한 번 잡고,
 * 그 뒤로는 예정일 규칙대로. 첫 읽기는 「바뀜」이 아니므로 알림·오탐이 없다.
 *
 * 실측(2026-10-16 KST, 감시와 같은 UA · node fetch):
 *  - welcon.kocca.kr/ → 109바이트 `<script>location.href = "/ko/main";</script>` 뿐.
 *    /ko/main 은 「콘텐츠 수출 허브 … WelCon 콘텐츠수출마케팅플랫폼」(135,914바이트)이라
 *    게임이용자 실태조사와 무관 — JS 이동을 따라가도 엉뚱한 페이지를 본다.
 *    실태조사는 kocca.kr 연구보고서 게시판(B0000147)에 올라온다(관측치 sourceUrl 10개 모두).
 *    「게임이용자 실태조사」 검색 목록 첫 행 = 「2025 게임이용자 실태조사 · 2025-12-18」
 *    (두 번 읽어 같음 · 출처 행 lastPublishedAt 과 같음). HEAD 는 403 → 게시판 감지(GET)라 무관.
 *  - euda_edr 의 2026_en = 「European Drug Report 2026: Trends and Developments」 — EDR 자기 주소.
 *    euda_statbulletin 이 같은 주소를 빌려 쓰고 있었다. 통계공보 고유 주소
 *    /data/stats2026_en = 「Statistical Bulletin 2026 home」. 그래서 옮기는 쪽은 statbulletin.
 */

export const KOCCA_GAME_URL =
  'https://www.kocca.kr/kocca/bbs/list/B0000147.do?menuNo=204153&searchCnd=1&searchWrd=%EA%B2%8C%EC%9E%84%EC%9D%B4%EC%9A%A9%EC%9E%90%20%EC%8B%A4%ED%83%9C%EC%A1%B0%EC%82%AC';

/** 감시 detectBoardLatest 셀렉터(accessDetail.board) — 실측 목록 표 구조 */
export const KOCCA_GAME_BOARD = {
  row: 'table tbody tr',
  title: 'td[data-label="제목"] a',
  date: 'td[data-label="등록일"]',
};

export const EUDA_STATBULLETIN_URL =
  'https://www.euda.europa.eu/data/stats2026_en';

export interface SourceUrlFix {
  id: string;
  from: string;
  to: string;
  /** null 이 아니면 access_detail 을 이 값으로 바꾼다(undefined = 그대로) */
  accessDetail?: Record<string, unknown> | null;
  reason: string;
}

export const SOURCE_URL_FIXES_R6: SourceUrlFix[] = [
  {
    id: 'kocca_game',
    from: 'https://welcon.kocca.kr/',
    to: KOCCA_GAME_URL,
    accessDetail: { board: KOCCA_GAME_BOARD },
    reason:
      'welcon.kocca.kr 은 JS 이동만 주는 콘텐츠수출 플랫폼(빈 본문 해시) — 실태조사가 올라오는 kocca.kr 연구보고서 게시판 검색 목록 첫 행으로 감시',
  },
  {
    id: 'euda_statbulletin',
    from: 'https://www.euda.europa.eu/publications/european-drug-report/2026_en',
    to: EUDA_STATBULLETIN_URL,
    reason:
      'euda_edr 과 같은 EDR 주소였음 — 통계공보 고유 주소(Statistical Bulletin 2026 home)로',
  },
];

/** 감시 설정을 바꾸는 SQL 1건 — from 일 때만(멱등). [sql, params] */
export function fixUpdateSql(f: SourceUrlFix): [string, unknown[]] {
  const sets = [
    'url = $2',
    'content_hash = NULL',
    'etag = NULL',
    'last_modified = NULL',
    'last_checked_at = NULL',
  ];
  const params: unknown[] = [f.id, f.to, f.from];
  if (f.accessDetail !== undefined) {
    params.push(f.accessDetail == null ? null : JSON.stringify(f.accessDetail));
    sets.push(`access_detail = $${params.length}::jsonb`);
  }
  return [
    `UPDATE sources SET ${sets.join(', ')} WHERE id = $1 AND url = $3 RETURNING id`,
    params,
  ];
}

/**
 * postgres UPDATE … RETURNING 결과 → 바뀐 행 수.
 * typeorm 은 UPDATE 에 [rows, count] 를 돌려준다(드라이버에 따라 rows 만).
 * (migration 파일은 export 를 모두 migration 으로 읽으므로 여기 둔다.)
 */
export function updatedCount(res: unknown): number {
  if (Array.isArray(res)) {
    if (
      res.length === 2 &&
      Array.isArray(res[0]) &&
      typeof res[1] === 'number'
    ) {
      return res[1];
    }
    return res.length;
  }
  return 0;
}

/** source_updated 사건 1건 SQL. detail = {from,to,reason,reset} */
export function fixEventSql(f: SourceUrlFix): [string, unknown[]] {
  const detail = {
    from: f.from,
    to: f.to,
    reason: f.reason,
    reset: ['contentHash', 'etag', 'lastModified', 'lastCheckedAt'],
    ...(f.accessDetail !== undefined ? { accessDetail: f.accessDetail } : {}),
    by: 'SOC-R6',
  };
  return [
    `INSERT INTO source_events (source_id, event_type, detail, notified) VALUES ($1, 'source_updated', $2::jsonb, false)`,
    [f.id, JSON.stringify(detail)],
  ];
}
