/**
 * 대표 문서 주소 수정 (SOC-R8 ■1).
 *
 * seed:documents 는 출처마다 대표 문서 1행을 「넣기만」 한다(sourceUrl = 그 출처의 url).
 * SOC-R6 가 감시 URL 둘(kocca_game · euda_statbulletin)을 고쳤지만 이미 있던 대표 문서
 * 행은 옛 주소 그대로라, 정책 문서 목록의 「게임이용자 실태조사」 링크가 R6 에서 무관하다고
 * 확인한 welcon 첫 화면으로 갔고 매일 seed_diff 1 이 남았다(R7 ■0).
 *
 * migration 으로 두 행의 source_url 만 옛 주소일 때 바꾸고(멱등), 바꾼 행마다
 * source_events 에 document_updated{documentId,field,from,to,reason} 를 남긴다.
 * seed 정의는 이미 출처 url 을 쓰므로 고칠 것이 없다 → 고친 뒤 seed_diff 0.
 */
import {
  EUDA_STATBULLETIN_URL,
  KOCCA_GAME_URL,
} from '../sources/source-url-fixes';

export interface DocumentUrlFix {
  /** 대표 문서의 source_id(= 출처 id) */
  sourceId: string;
  from: string;
  to: string;
  reason: string;
}

export const DOCUMENT_URL_FIXES_R8: DocumentUrlFix[] = [
  {
    sourceId: 'kocca_game',
    from: 'https://welcon.kocca.kr/',
    to: KOCCA_GAME_URL,
    reason:
      '감시 URL(SOC-R6)과 같게 — welcon.kocca.kr 은 콘텐츠수출 플랫폼 첫 화면, 실태조사는 kocca.kr 연구보고서 게시판',
  },
  {
    sourceId: 'euda_statbulletin',
    from: 'https://www.euda.europa.eu/publications/european-drug-report/2026_en',
    to: EUDA_STATBULLETIN_URL,
    reason:
      '감시 URL(SOC-R6)과 같게 — 옛 주소는 유럽마약보고서(EDR) 주소, 통계공보 고유 주소로',
  },
];

/** 대표 문서 1행의 source_url 을 옛 주소일 때만 바꾸는 SQL(멱등). [sql, params] */
export function documentFixSql(f: DocumentUrlFix): [string, unknown[]] {
  return [
    `UPDATE documents SET source_url = $2, updated_at = now() WHERE source_id = $1 AND source_url = $3 RETURNING id`,
    [f.sourceId, f.to, f.from],
  ];
}

/** UPDATE … RETURNING 결과 → 바뀐 문서 id 들(typeorm 은 [rows, count] 또는 rows). */
export function returnedIds(res: unknown): number[] {
  const rows =
    Array.isArray(res) && res.length === 2 && Array.isArray(res[0])
      ? (res[0] as unknown[])
      : Array.isArray(res)
        ? (res as unknown[])
        : [];
  return rows
    .map((r) => Number((r as { id?: unknown })?.id))
    .filter((n) => Number.isFinite(n));
}

/** document_updated 사건 1건 SQL. detail = {documentId,field,from,to,reason,by} */
export function documentEventSql(
  f: DocumentUrlFix,
  documentId: number,
): [string, unknown[]] {
  const detail = {
    documentId,
    field: 'sourceUrl',
    from: f.from,
    to: f.to,
    reason: f.reason,
    by: 'SOC-R8',
  };
  return [
    `INSERT INTO source_events (source_id, event_type, detail, notified) VALUES ($1, 'document_updated', $2::jsonb, false)`,
    [f.sourceId, JSON.stringify(detail)],
  ];
}
