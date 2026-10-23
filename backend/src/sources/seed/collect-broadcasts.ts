/**
 * 연대기 「방송」 줄 수집 (SOC-R1 ■7) — 매일 예약이 하루 한 번 돌린다.
 *
 * 실행: npm run collect:broadcasts
 * 중독뉴스 공개 API 를 GET 으로만 읽는다(열쇠 0). 링크 기준 중복은
 * ON CONFLICT DO NOTHING 으로 건너뛴다 — 넣기만, 지우기 없음.
 * SOC-R12: ① source_en 이 비었거나 정본과 다르면 맞춘다 ② 목록에서 빠진 편은
 * hidden_reason='source_archived' 로 연대기 공개에서 내리고, 다시 실리면 다시 보인다(행 지움 0).
 * 수: inserted = 새 행 · updated = 영어 이름 맞춤 + 내림 + 다시 보임 · skipped = 이미 있던 행.
 * 주소: env ADDICTION_NEWS_API_URL (기본 중독뉴스 운영 주소).
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import {
  archiveDecision,
  BROADCAST_FETCH_LIMIT,
  DEFAULT_NEWS_API_URL,
  SOURCE_ARCHIVED,
  toBroadcastRows,
  type StoredBroadcast,
} from '../broadcast.util';
import { printJobCounts } from '../../common/job-counts';

async function run() {
  const base = (
    process.env.ADDICTION_NEWS_API_URL?.trim() || DEFAULT_NEWS_API_URL
  ).replace(/\/+$/, '');
  const res = await fetch(
    `${base}/articles/latest?kind=broadcast&limit=${BROADCAST_FETCH_LIMIT}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body: unknown = await res.json();
  const rows = toBroadcastRows(body);
  // 꽉 찬 목록 판정은 거르기 전 줄 수로(리뷰 찾기 1)
  const feedSize = Array.isArray(body) ? body.length : 0;

  const ds = AppDataSource;
  await ds.initialize();
  let inserted = 0;
  let named = 0;
  for (const r of rows) {
    const out: unknown = await ds.query(
      `INSERT INTO "broadcast_items" ("url", "title", "broadcaster", "published_at", "grade", "source_en")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("url") DO NOTHING
       RETURNING "id"`,
      [r.url, r.title, r.broadcaster, r.publishedAt, r.grade, r.sourceEn],
    );
    if (Array.isArray(out) && out.length > 0) {
      inserted++;
      continue;
    }
    if (r.sourceEn) {
      const upd: unknown = await ds.query(
        `UPDATE "broadcast_items" SET "source_en" = $2
          WHERE "url" = $1 AND "source_en" IS DISTINCT FROM $2
          RETURNING "id"`,
        [r.url, r.sourceEn],
      );
      if (Array.isArray(upd) && upd.length > 0) named++;
    }
  }

  const all: { id: number; url: string; hidden_reason: string | null }[] =
    await ds.query(
      `SELECT "id", "url", "hidden_reason" FROM "broadcast_items"`,
    );
  const stored: StoredBroadcast[] = all.map((x) => ({
    id: x.id,
    url: x.url,
    hiddenReason: x.hidden_reason,
  }));
  const d = archiveDecision(stored, new Set(rows.map((r) => r.url)), feedSize);
  if (d.hide.length > 0) {
    await ds.query(
      `UPDATE "broadcast_items" SET "hidden_reason" = $2, "hidden_at" = now()
        WHERE "id" = ANY($1) AND "hidden_reason" IS NULL`,
      [d.hide, SOURCE_ARCHIVED],
    );
  }
  if (d.unhide.length > 0) {
    await ds.query(
      `UPDATE "broadcast_items" SET "hidden_reason" = NULL, "hidden_at" = NULL
        WHERE "id" = ANY($1) AND "hidden_reason" = $2`,
      [d.unhide, SOURCE_ARCHIVED],
    );
  }
  console.log(
    `[collect:broadcasts] 받음 ${rows.length}건 · 새로 넣음 ${inserted}건 · 영어 이름 맞춤 ${named}건 · ` +
      `내림(source_archived) ${d.hide.length}건 · 다시 보임 ${d.unhide.length}건` +
      (d.held ? ` · 내리기 보류(${d.held})` : ''),
  );
  printJobCounts({
    inserted,
    updated: named + d.hide.length + d.unhide.length,
    skipped: rows.length - inserted,
  });
  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect:broadcasts] 실패:', e);
  process.exit(1);
});
