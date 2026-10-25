/**
 * 연대기 「방송」 줄 수집 (SOC-R1 ■7) — 매일 예약이 하루 한 번 돌린다.
 *
 * 실행: npm run collect:broadcasts
 * 중독뉴스 공개 API 를 GET 으로만 읽는다(열쇠 0). 링크 기준 중복은
 * ON CONFLICT DO NOTHING 으로 건너뛴다 — 넣기만, 지우기 없음.
 * SOC-R12: ① source_en 이 비었거나 정본과 다르면 맞춘다 ② 목록에서 빠진 편은
 * hidden_reason='source_archived' 로 연대기 공개에서 내리고, 다시 실리면 다시 보인다(행 지움 0).
 * SOC-R13: ③ news_id(중독뉴스 id)를 채운다 ④ 보관 목록(NEWS-Q14 ■5 · GET /api/broadcast/archive?tier=all)의
 * tier 로 내린다 — 주소를 비우거나(null) · 못 읽거나 · 꼴이 틀리거나 · available false 면 ② 그대로.
 * SOC-R15: ⑤ 보관 목록이 스스로 「publish 전 기간 · 잘리지 않음」을 말하면(archiveListScope · NEWS-Q16 ■4)
 * 목록이 정본 — 두 목록에 없는 보이는 행은 source_unlisted 로 내림. 아니면 「두 목록에 없음 = 그대로」(대기).
 * 수: inserted = 새 행 · updated = 칸 맞춤(영어 이름 · news_id) + 내림 + 다시 보임 · skipped = 이미 있던 행.
 * 주소: env ADDICTION_NEWS_API_URL (기본 중독뉴스 운영 주소).
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import {
  archiveDecision,
  archiveListDecision,
  archiveListIds,
  archiveListScope,
  BROADCAST_ARCHIVE_LIST_PATH,
  BROADCAST_FETCH_LIMIT,
  DEFAULT_NEWS_API_URL,
  parseArchiveList,
  SOURCE_ARCHIVED,
  SOURCE_DELETED,
  SOURCE_UNLISTED,
  toBroadcastRows,
  type ArchiveDecision,
  type ArchiveListEntry,
  type ArchiveListScope,
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
async function readArchiveList(base: string): Promise<{
  list: ArchiveListEntry[] | null;
  scope: ArchiveListScope | null;
  ids: Set<number> | null;
  note: string;
}> {
  if (!BROADCAST_ARCHIVE_LIST_PATH) {
    return { list: null, scope: null, ids: null, note: '대기' };
  }
  try {
    const body = await getJson(`${base}${BROADCAST_ARCHIVE_LIST_PATH}`);
    const list = parseArchiveList(body);
    const scope = archiveListScope(body);
    return list
      ? {
          list,
          scope,
          ids: archiveListIds(body),
          note:
            `보관 목록 ${list.length}줄 · ` +
            (scope.canonical
              ? '정본(publish 전 기간)'
              : `publish 창 대기${scope.publishAllTime ? '(잘림)' : ''}`),
        }
      : {
          list: null,
          scope: null,
          ids: null,
          note: '보관 목록 꼴 틀림 → 지금 규칙',
        };
  } catch (e) {
    return {
      list: null,
      scope: null,
      ids: null,
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
    ? archiveListDecision(stored, archiveList.list, feedUrls, {
        canonical: archiveList.scope?.canonical === true,
        listedIds: archiveList.ids ?? undefined,
      })
    : null;
  const d: ArchiveDecision =
    listed ?? archiveDecision(stored, feedUrls, feedSize);
  // 원천 까닭(보관 · 지움 · 목록 밖)끼리는 까닭만 바꾼다 · 사람 숨김(그 밖 까닭)은 건드리지 않음
  const sourceReasons = [SOURCE_ARCHIVED, SOURCE_DELETED, SOURCE_UNLISTED];
  const hideAs = async (ids: number[], reason: string) =>
    ids.length === 0
      ? 0
      : updatedCount(
          await ds.query(
            `UPDATE "broadcast_items"
                SET "hidden_reason" = $2, "hidden_at" = COALESCE("hidden_at", now())
              WHERE "id" = ANY($1) AND ("hidden_reason" IS NULL OR "hidden_reason" = ANY($3))`,
            [ids, reason, sourceReasons],
          ),
        );
  const hidden = await hideAs(d.hide, SOURCE_ARCHIVED);
  const deleted = listed ? await hideAs(listed.hideDeleted, SOURCE_DELETED) : 0;
  const unlistedHidden = listed
    ? await hideAs(listed.hideUnlisted, SOURCE_UNLISTED)
    : 0;
  let shown = 0;
  if (d.unhide.length > 0) {
    shown = updatedCount(
      await ds.query(
        `UPDATE "broadcast_items" SET "hidden_reason" = NULL, "hidden_at" = NULL
          WHERE "id" = ANY($1) AND "hidden_reason" = ANY($2)`,
        [d.unhide, sourceReasons],
      ),
    );
  }
  // 영상 id 로 짝을 찾은 옛 행의 news_id(SOC-R14 ■3) — 비어 있을 때만
  let idFilled = 0;
  for (const f of listed?.idFill ?? []) {
    idFilled += updatedCount(
      await ds.query(
        `UPDATE "broadcast_items" SET "news_id" = $2 WHERE "id" = $1 AND "news_id" IS NULL`,
        [f.id, f.newsId],
      ),
    );
  }
  console.log(
    `[collect:broadcasts] 받음 ${rows.length}건 · 새로 넣음 ${inserted}건 · 칸 맞춤(영어 이름·news_id) ${fixed}건 · ` +
      `내림(source_archived) ${hidden}건 · 내림(source_deleted) ${deleted}건 · ` +
      `내림(source_unlisted) ${unlistedHidden}건 · 다시 보임 ${shown}건 · ` +
      `영상 id 로 news_id ${idFilled}건 · 기준 ${listed ? '보관 목록' : '방송 목록'}(${archiveList.note})` +
      (listed && listed.unlisted.length > 0
        ? ` · 두 목록에 없음 ${listed.unlisted.length}건(그대로)`
        : '') +
      (d.held ? ` · 내리기 보류(${d.held})` : ''),
  );
  printJobCounts({
    inserted,
    updated: fixed + hidden + deleted + unlistedHidden + shown + idFilled,
    skipped: rows.length - inserted,
  });
  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect:broadcasts] 실패:', e);
  process.exit(1);
});
