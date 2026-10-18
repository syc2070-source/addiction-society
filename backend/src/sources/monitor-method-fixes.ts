/**
 * 감시 방식 수정 (SOC-R8 ■3) — hri_gshr: Last-Modified → 본문 해시.
 *
 * hri.global 페이지는 발간과 무관하게 Last-Modified 가 1~3일마다 바뀌어 10월에만 changed
 * 사건이 6번 남았다(10-03 · 06 · 11 · 15 · 16 · 17). missed 계산은 changed 를 「발간
 * 확인」으로 쳐서, 11월 예정이 지나도 「지난 예정」 줄이 서지 않을 수 있었다(거짓 확인).
 *
 * 실측(2026-10-18 KST · 감시와 같은 UA · 4초 간격 3회): HEAD 200 · ETag 없음 ·
 * Last-Modified 「Fri, 16 Oct 2026 09:54:59 GMT」 · GET 200 79,059바이트 · 정규화 해시
 * e1e8f84844… 3회 같음. (며칠 사이 해시가 흔들리는지는 아직 못 쟀다.)
 *
 * 감시 설정 access_detail.detect = 'hash' (scheduler detectChange 가 HEAD 검증자를 건너뜀) ·
 * 옛 기준선(last_modified · etag · content_hash)은 비운다 → 다음 감시가 첫 기준선을 잡고
 * 「바뀜」으로 보지 않는다. lastCheckedAt 은 그대로(예정 11-01 이라 매일 감시 대상).
 * 바꾼 사실은 source_events 에 source_updated 로 남긴다.
 */
export const HRI_MONITOR_FIX = {
  id: 'hri_gshr',
  from: 'last-modified',
  to: 'hash',
  reason:
    'Last-Modified 가 발간과 무관하게 1~3일마다 바뀜(10월 changed 6) — 본문 해시로 감시(euda 와 같은 꼴)',
} as const;

/** 감시 방식을 바꾸는 SQL(아직 detect 가 없을 때만 · 멱등). [sql, params] */
export function hriFixSql(): [string, unknown[]] {
  return [
    `UPDATE sources SET access_detail = COALESCE(access_detail, '{}'::jsonb) || jsonb_build_object('detect', $2::text), last_modified = NULL, etag = NULL, content_hash = NULL WHERE id = $1 AND (access_detail IS NULL OR access_detail->>'detect' IS NULL) RETURNING id`,
    [HRI_MONITOR_FIX.id, HRI_MONITOR_FIX.to],
  ];
}

/** source_updated 사건 SQL. detail = {field,from,to,reason,reset,by} */
export function hriEventSql(): [string, unknown[]] {
  const detail = {
    field: 'accessDetail.detect',
    from: HRI_MONITOR_FIX.from,
    to: HRI_MONITOR_FIX.to,
    reason: HRI_MONITOR_FIX.reason,
    reset: ['lastModified', 'etag', 'contentHash'],
    by: 'SOC-R8',
  };
  return [
    `INSERT INTO source_events (source_id, event_type, detail, notified) VALUES ($1, 'source_updated', $2::jsonb, false)`,
    [HRI_MONITOR_FIX.id, JSON.stringify(detail)],
  ];
}
