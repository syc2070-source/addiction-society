/**
 * ECO-LINK1 받는 문 (SOC-R15 ■4) — Statory 카드 · 중독뉴스 기사를 eco_inbox(검수 대기)로 받는다.
 *
 * 실행: npm run import:eco
 * **스위치: env ECO_LINK1_INBOX_ENABLED=true 일 때만 돈다**(그 밖 = 꺼짐 · DB 를 열지 않고 「꺼짐」만 적고 끝).
 * 켜면 매일 예약(04:00)에도 이 단계가 붙는다(dailySteps · refresh:home 앞).
 *
 * 원천(읽기만 · GET):
 *  - Statory: env ECO_SOURCE_LATEST_URL(Statory 공개 자리 · ASK-58 ■3 · SOC-R16 ■4) + 읽기 열쇠 ECO_SOURCE_READ_KEY
 *    (요청 머리 ECO_SOURCE_READ_HEADER · 값은 적지 않음) — URL 이 비면 「미설정」 한 줄만(옛 이름 ECO_STATORY_EXPORT_URL 은 읽지 않음).
 *  - 중독뉴스: `${ADDICTION_NEWS_API_URL}/api/export/articles?kind=article|broadcast&tier=publish&cursor=` ·
 *    열쇠 env ECO_NEWS_EXPORT_KEY(요청 머리 x-export-key · 값은 적지 않음) — 없으면 건너뜀.
 * 쓰기: 넣기(ON CONFLICT DO NOTHING) · 본 행 last_seen · 빠진 행 upstream='withdrawn' · C2 열쇠 옮김 — 행 지움 0.
 * 결정 칸(review_decision)은 새 줄의 상속 값만 쓴다 — 사람이 정한 결정을 기계가 덮지 않는다.
 */
import 'reflect-metadata';
import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { printJobCounts } from '../../common/job-counts';
import { envelopeJobCounts, readEnvelope } from '../card-envelope';
import {
  ecoInboxEnabled,
  ECO_INBOX_SWITCH,
  ECO_SOURCE_LATEST_URL,
  isKciCard,
  kciNarrowPayload,
  planInbox,
  readCardLines,
  readNewsLines,
  readNewsPage,
  statorySource,
  type InboxLine,
  type InboxPlan,
  type LinesRead,
  type Origin,
  type StoredInbox,
} from '../eco-inbox';
import { DEFAULT_NEWS_API_URL } from '../../sources/broadcast.util';
import { updatedCount } from '../../sources/source-url-fixes';

/** 중독뉴스 export 한 kind 의 쪽 상한(200 줄 × 100 = 2만) — 넘으면 「전부 당기기」가 아님 → withdrawn 안 돌림 */
const NEWS_MAX_PAGES = 100;
/** Statory build-evidence-export.mjs EVIDENCE_READ_LIMIT — 이만큼 오면 잘렸을 수 있음 */
const STATORY_EXPORT_READ_LIMIT = 5000;

async function getJson(
  url: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
    // 열쇠 머리가 다른 주소로 따라가지 않게 — 넘겨주기(redirect)는 실패로(리뷰 B 규칙 3)
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface Pulled {
  origin: Origin;
  read: LinesRead;
  full: boolean;
  generatedAt: string | null;
  note: string;
  envelopeCounts?: ReturnType<typeof envelopeJobCounts>;
}

async function pullStatory(prev: string | null): Promise<Pulled | string> {
  const src = statorySource();
  if (!src) return `Statory 미설정(${ECO_SOURCE_LATEST_URL} 빈 값) → 건너뜀`;
  let body: unknown;
  try {
    body = await getJson(src.url, src.headers);
  } catch (e) {
    return `Statory 못 읽음(${(e as Error).message}) → 건너뜀`;
  }
  const env = readEnvelope(body, prev);
  if (!env.ok) return `Statory 봉투 거절 ${env.reject} → 건너뜀(숨김 상속 0)`;
  const read = readCardLines(env);
  // Statory 생성기는 표를 EVIDENCE_READ_LIMIT(5000) 줄까지만 읽고 잘림 칸이 없다 — 꽉 찼거나 빈 봉투는
  // 「전부」로 믿지 않는다(withdrawn 0 · 리뷰 B4)
  const full =
    env.items.length > 0 && env.items.length < STATORY_EXPORT_READ_LIMIT;
  return {
    origin: 'statory',
    read,
    full,
    generatedAt: (body as { generated_at: string }).generated_at,
    note:
      `Statory 봉투 ${env.form} · 줄 ${env.items.length} · missing 거절 ${env.missingRejected.length}` +
      (full ? '' : ' · 빈/꽉 찬 봉투 → withdrawn 안 돌림'),
    envelopeCounts: envelopeJobCounts(env),
  };
}

async function pullNews(): Promise<Pulled | string> {
  const key = process.env.ECO_NEWS_EXPORT_KEY?.trim();
  if (!key) return '중독뉴스 열쇠 없음(ECO_NEWS_EXPORT_KEY) → 건너뜀';
  const base = (
    process.env.ADDICTION_NEWS_API_URL?.trim() || DEFAULT_NEWS_API_URL
  ).replace(/\/+$/, '');
  const pages: { items: unknown[]; kind: 'article' | 'broadcast' }[] = [];
  let full = true;
  for (const kind of ['article', 'broadcast'] as const) {
    let cursor: string | null = null;
    let n = 0;
    do {
      const q = new URLSearchParams({ kind, tier: 'publish' });
      if (cursor) q.set('cursor', cursor);
      let body: unknown;
      try {
        body = await getJson(`${base}/api/export/articles?${q.toString()}`, {
          'x-export-key': key,
        });
      } catch (e) {
        return `중독뉴스 못 읽음(${kind} · ${(e as Error).message}) → 건너뜀`;
      }
      const page = readNewsPage(body);
      if (!page) return `중독뉴스 꼴 틀림(${kind}) → 건너뜀(숨김 상속 0)`;
      pages.push({ items: page.items, kind });
      cursor = page.nextCursor;
      n++;
    } while (cursor && n < NEWS_MAX_PAGES);
    if (cursor) full = false;
  }
  const read = readNewsLines(pages);
  return {
    origin: 'addicted-news',
    read,
    full,
    generatedAt: null,
    note: `중독뉴스 쪽 ${pages.length}${full ? '' : ' · 상한 → withdrawn 안 돌림'}`,
  };
}

async function run() {
  if (!ecoInboxEnabled()) {
    console.log(
      `[import:eco] 스위치 꺼짐(${ECO_INBOX_SWITCH}) — 아무것도 하지 않음`,
    );
    printJobCounts({});
    return;
  }
  const ds = AppDataSource;
  await ds.initialize();
  const prevRows: { at: Date | null }[] = await ds.query(
    `SELECT max("source_generated_at") AS "at" FROM "eco_inbox" WHERE "origin" = 'statory'`,
  );
  const prev = prevRows[0]?.at ? new Date(prevRows[0].at).toISOString() : null;
  const results = [await pullStatory(prev), await pullNews()];

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let envelope: Pulled['envelopeCounts'];
  const notes: string[] = [];
  for (const p of results) {
    if (typeof p === 'string') {
      notes.push(p);
      continue;
    }
    envelope = p.envelopeCounts ?? envelope;
    // 한 원천의 읽기 · 계획 · 쓰기를 한 트랜잭션으로 — 행을 잠가 그사이 사람 결정 · 다른 회차와 엇갈리지 않게(리뷰 2 · 3)
    let r: Applied;
    try {
      r = await ds.transaction((m) => applyOrigin(m, p));
    } catch (e) {
      notes.push(`${p.origin} 쓰기 되돌림(${(e as Error).message})`);
      continue;
    }
    inserted += r.added;
    updated += r.moved + r.plan.republic.length + r.withdrawn;
    skipped += r.seen - r.plan.republic.length + p.read.rejected.length;
    const inheritedKeep = r.plan.insert.filter((i) => i.keepFromVersion).length;
    const inheritedHide = r.plan.insert.filter(
      (i) => i.reviewDecision === 'hide',
    ).length;
    notes.push(
      `${p.note} · 받음 ${p.read.lines.length} · 줄 거절 ${p.read.rejected.length}` +
        `(${summarize(p.read.rejected.map((x) => x.reason))}) · 새로 넣음 ${r.added}` +
        `(물려받은 keep ${inheritedKeep} · hide ${inheritedHide}) · 열쇠 옮김(C2) ${r.moved}` +
        ` · 다시 public ${r.plan.republic.length} · withdrawn ${r.withdrawn}` +
        (p.read.protect ? '' : '(멈춤 — id 를 모르는 거절 줄)') +
        ` · 모르는 열쇠 ${p.read.unreceived.length}`,
    );
  }
  console.log(`[import:eco] ${notes.join(' / ')}`);
  printJobCounts({
    ...(envelope ?? {}),
    inserted,
    updated,
    skipped: Math.max(0, skipped),
  });
  await ds.destroy();
}

interface Applied {
  plan: InboxPlan;
  moved: number;
  added: number;
  seen: number;
  withdrawn: number;
}

async function applyOrigin(m: EntityManager, p: Pulled): Promise<Applied> {
  const rows: {
    id: number;
    slug: string;
    version: string;
    paper_key: string;
    upstream: string;
    review_decision: 'keep' | 'hide' | null;
    reviewed_at: Date | null;
    keep_from_version: string | null;
    key_moved_from: string | null;
  }[] = await m.query(
    `SELECT "id", "slug", "version", "paper_key", "upstream", "review_decision", "reviewed_at",
            "keep_from_version", "key_moved_from"
       FROM "eco_inbox" WHERE "origin" = $1 ORDER BY "id" FOR UPDATE`,
    [p.origin],
  );
  const stored: StoredInbox[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    version: r.version,
    paperKey: r.paper_key,
    upstream: r.upstream,
    reviewDecision: r.review_decision,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : null,
    keepFromVersion: r.keep_from_version,
    keyMovedFrom: r.key_moved_from,
  }));
  const plan = planInbox(stored, p.read.lines, p.full, p.read.protect);
  let moved = 0;
  for (const k of plan.keyMoves) {
    moved += updatedCount(
      await m.query(
        `UPDATE "eco_inbox" SET "paper_key" = $2, "key_moved_from" = $3, "key_moved_at" = now()
          WHERE "id" = $1 AND "key_moved_from" IS NULL AND "paper_key" = $3
          RETURNING "id"`,
        [k.id, k.to, k.from],
      ),
    );
  }
  // 계획한 열쇠 옮김이 다 서지 않았으면 그 상속도 믿을 수 없다 → 이 원천 전체를 되돌림(다음 회차가 다시 잼)
  if (moved !== plan.keyMoves.length) {
    throw new Error(`열쇠 옮김 ${moved}/${plan.keyMoves.length}`);
  }
  let added = 0;
  for (const l of plan.insert) {
    added += await insertLine(m, l, p.generatedAt);
  }
  const seen = plan.seen.length
    ? updatedCount(
        await m.query(
          `UPDATE "eco_inbox" SET "last_seen_at" = now(), "upstream" = 'public',
                  "source_generated_at" = COALESCE($2, "source_generated_at")
            WHERE "id" = ANY($1) RETURNING "id"`,
          [plan.seen, p.generatedAt],
        ),
      )
    : 0;
  // 본 행의 내용 칸 — 원천이 고친 제목 · 하위 유형 · 영어 이름이 따라오게(리뷰 B3). **검토 대기 행만**:
  // 사람이 정한(또는 물려받은) 행은 그 사람이 본 내용 그대로 둔다 — 면허가 넓어져 손님에게 안 본 발견이
  // 서는 일 0(반박 5) · 바뀐 것이 있을 때만 쓴다(반박 3) · 결정 칸 · 열쇠는 건드리지 않음.
  for (const { id, line: l } of plan.refresh) {
    await m.query(
      `UPDATE "eco_inbox"
          SET "title" = $2, "url" = $3, "grade" = $4, "subtype" = $5, "topic" = $6,
              "licence" = $7, "licence_use" = $8, "missing" = $9, "payload" = $10
        WHERE "id" = $1 AND "review_decision" IS NULL AND "reviewed_at" IS NULL
          AND ("title", "url", "grade", "subtype", "topic", "licence", "licence_use", "missing", "payload")
              IS DISTINCT FROM ($2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb)`,
      [
        id,
        l.title,
        l.url,
        l.grade,
        JSON.stringify(l.subtype),
        l.topic,
        l.licence,
        l.licenceUse,
        l.missing ? JSON.stringify(l.missing) : null,
        JSON.stringify(l.payload),
      ],
    );
    // KCI 유래로 바뀐(또는 KCI 인) 줄은 **결정이 있는 행**도 payload 를 KCI 꼴(서지 + 링크 + 인용)로 줄인다(리뷰 B1 ·
    // 초록 · 발견이 옛 payload 에 남지 않게). 좁히기만(반박 2): 사람이 본 인용은 그대로 · use_until 은 이른 쪽(kciNarrowPayload).
    // 검토 대기 행은 위 UPDATE 가 이미 새 payload 로 맞춤.
    if (isKciCard(l.payload)) {
      const cur: { payload: Record<string, unknown> | null }[] = await m.query(
        `SELECT "payload" FROM "eco_inbox"
          WHERE "id" = $1 AND ("review_decision" IS NOT NULL OR "reviewed_at" IS NOT NULL)`,
        [id],
      );
      if (cur.length > 0) {
        const next = JSON.stringify(
          kciNarrowPayload(cur[0].payload ?? {}, l.payload),
        );
        await m.query(
          `UPDATE "eco_inbox" SET "payload" = $2::jsonb
            WHERE "id" = $1 AND "payload" IS DISTINCT FROM $2::jsonb`,
          [id, next],
        );
      }
    }
  }
  const withdrawn = plan.withdraw.length
    ? updatedCount(
        await m.query(
          `UPDATE "eco_inbox" SET "upstream" = 'withdrawn'
            WHERE "id" = ANY($1) AND "upstream" = 'public' RETURNING "id"`,
          [plan.withdraw],
        ),
      )
    : 0;
  return { plan, moved, added, seen, withdrawn };
}

async function insertLine(
  m: EntityManager,
  l: InboxLine & {
    reviewDecision: 'keep' | 'hide' | null;
    keepFromVersion: string | null;
  },
  generatedAt: string | null,
): Promise<number> {
  const out: unknown = await m.query(
    `INSERT INTO "eco_inbox" ("origin", "slug", "version", "paper_key", "title", "url", "grade", "kind",
            "subtype", "topic", "licence", "licence_use", "missing", "payload", "source_generated_at",
            "review_decision", "keep_from_version")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT ("origin", "slug", "version") DO NOTHING
     RETURNING "id"`,
    [
      l.origin,
      l.slug,
      l.version,
      l.paperKey,
      l.title,
      l.url,
      l.grade,
      l.kind,
      JSON.stringify(l.subtype),
      l.topic,
      l.licence,
      l.licenceUse,
      l.missing ? JSON.stringify(l.missing) : null,
      JSON.stringify(l.payload),
      generatedAt,
      l.reviewDecision,
      l.keepFromVersion,
    ],
  );
  return Array.isArray(out) && out.length > 0 ? 1 : 0;
}

function summarize(reasons: string[]): string {
  const c = new Map<string, number>();
  for (const r of reasons) c.set(r, (c.get(r) ?? 0) + 1);
  return [...c].map(([k, n]) => `${k} ${n}`).join(' · ') || '0';
}

run().catch((e) => {
  console.error('[import:eco] 실패:', e);
  process.exit(1);
});
