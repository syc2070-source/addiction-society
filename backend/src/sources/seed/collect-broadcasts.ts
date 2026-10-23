/**
 * 연대기 「방송」 줄 수집 (SOC-R1 ■7) — 매일 예약이 하루 한 번 돌린다.
 *
 * 실행: npm run collect:broadcasts
 * 중독뉴스 공개 API 를 GET 으로만 읽는다(열쇠 0). 링크 기준 중복은
 * ON CONFLICT DO NOTHING 으로 건너뛴다 — 넣기만, 지우기 없음.
 * SOC-R12: ① source_en 이 비었거나 정본과 다르면 맞춘다 ② 목록에서 빠진 편은
 * hidden_reason='source_archived' 로 연대기 공개에서 내리고, 다시 실리면 다시 보인다(행 지움 0).
 * SOC-R13: ③ news_id(중독뉴스 id)를 채운다 ④ 보관 목록(NEWS-Q14 ■5)이 열려 있으면(BROADCAST_ARCHIVE_LIST_PATH)
 * 그 tier 로 내린다 — 주소가 없거나 · 못 읽거나 · 꼴이 틀리면 ② 그대로(「대기」).
 * 수: inserted = 새 행 · updated = 칸 맞춤(영어 이름 · news_id) + 내림 + 다시 보임 · skipped = 이미 있던 행.
 * 주소: env ADDICTION_NEWS_API_URL (기본 중독뉴스 운영 주소).
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import {
  archiveDecision,
  archiveListDecision,
  BROADCAST_ARCHIVE_LIST_PATH,
  BROADCAST_FETCH_LIMIT,
  DEFAULT_NEWS_API_URL,
  parseArchiveList,
  SOURCE_ARCHIVED,
  toBroadcastRows,
  type ArchiveDecision,
  type ArchiveListEntry,
  type StoredBroadcast,
} from '../broadcast.util';
import { updatedCount } from '../source-url-fixes';
import { printJobCounts } from '../../common/job-counts';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** 보관 목록 — 주소가 없으면 null(대기) · 못 읽음 · 꼴 틀림도 null(지금 규칙으로) */
async function readArchiveList(
  base: string,
): Promise<{ list: ArchiveListEntry[] | null; note: string }> {
  if (!BROADCAST_ARCHIVE_LIST_PATH) return { list: null, note: '대기' };
  try {
    const list = parseArchiveList(
      await getJson(`${base}${BROADCAST_ARCHIVE_LIST_PATH}`),
    );
    return list
      ? { list, note: `보관 목록 ${list.length}줄` }
      : { list: null, note: '보관 목록 꼴 틀림 → 지금 규칙' };
  } catch (e) {
    return {
      list: null,
      note: `보관 목록 못 읽음(${(e as Error).message}) → 지금 규칙`,
    };
  }
}

async function run() {
  const base = (
    process.env.ADDICTION_NEWS_API_URL?.trim() || DEFAULT_NEWS_API_URL
  ).replace(/\/+$/, '');
  const body = await getJson(
    `${base}/articles/latest?kind=broadcast&limit=${BROADCAST_FETCH_LIMIT}`,
  );
  const rows = toBroadcastRows(body);
  // 꽉 찬 목록 판정은 거르기 전 줄 수로(리뷰 찾기 1)
  const feedSize = Array.isArray(body) ? body.length : 0;
  const archiveList = await readArchiveList(base);

  const ds = AppDataSource;
  await ds.initialize();
  let inserted = 0;
  let fixed = 0;
  for (const r of rows) {
    const out: unknown = await ds.query(
      `INSERT INTO "broadcast_items" ("url", "title", "broadcaster", "published_at", "grade", "source_en", "news_id")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("url") DO NOTHING
       RETURNING "id"`,
      [
        r.url,
        r.title,
        r.broadcaster,
        r.publishedAt,
        r.grade,
        r.sourceEn,
        r.newsId,
      ],
    );
    if (Array.isArray(out) && out.length > 0) {
      inserted++;
      continue;
    }
    if (r.sourceEn || r.newsId) {
      // typeorm 은 UPDATE 에 [rows, count] 를 돌려준다 — 배열 길이로 세면 늘 1(10-24 04:00 「맞춤 9」 · SOC-R13)
      fixed += updatedCount(
        await ds.query(
          `UPDATE "broadcast_items"
              SET "source_en" = COALESCE($2, "source_en"), "news_id" = COALESCE($3, "news_id")
            WHERE "url" = $1
              AND ("source_en" IS DISTINCT FROM COALESCE($2, "source_en")
                OR "news_id" IS DISTINCT FROM COALESCE($3, "news_id"))
            RETURNING "id"`,
          [r.url, r.sourceEn, r.newsId],
        ),
      );
    }
  }

  const all: {
    id: number;
    url: string;
    hidden_reason: string | null;
    news_id: number | null;
  }[] = await ds.query(
    `SELECT "id", "url", "hidden_reason", "news_id" FROM "broadcast_items"`,
  );
  const stored: StoredBroadcast[] = all.map((x) => ({
    id: x.id,
    url: x.url,
    hiddenReason: x.hidden_reason,
    newsId: x.news_id,
  }));
  const feedUrls = new Set(rows.map((r) => r.url));
  const listed = archiveList.list
    ? archiveListDecision(stored, archiveList.list, feedUrls)
    : null;
  const d: ArchiveDecision =
    listed ?? archiveDecision(stored, feedUrls, feedSize);
  let hidden = 0;
  let shown = 0;
  if (d.hide.length > 0) {
    hidden = updatedCount(
      await ds.query(
        `UPDATE "broadcast_items" SET "hidden_reason" = $2, "hidden_at" = now()
          WHERE "id" = ANY($1) AND "hidden_reason" IS NULL`,
        [d.hide, SOURCE_ARCHIVED],
      ),
    );
  }
  if (d.unhide.length > 0) {
    shown = updatedCount(
      await ds.query(
        `UPDATE "broadcast_items" SET "hidden_reason" = NULL, "hidden_at" = NULL
          WHERE "id" = ANY($1) AND "hidden_reason" = $2`,
        [d.unhide, SOURCE_ARCHIVED],
      ),
    );
  }
  console.log(
    `[collect:broadcasts] 받음 ${rows.length}건 · 새로 넣음 ${inserted}건 · 칸 맞춤(영어 이름·news_id) ${fixed}건 · ` +
      `내림(source_archived) ${hidden}건 · 다시 보임 ${shown}건 · 기준 ${listed ? '보관 목록' : '방송 목록'}(${archiveList.note})` +
      (listed && listed.unlisted.length > 0
        ? ` · 두 목록에 없음 ${listed.unlisted.length}건(그대로)`
        : '') +
      (d.held ? ` · 내리기 보류(${d.held})` : ''),
  );
  printJobCounts({
    inserted,
    updated: fixed + hidden + shown,
    skipped: rows.length - inserted,
  });
  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect:broadcasts] 실패:', e);
  process.exit(1);
});
