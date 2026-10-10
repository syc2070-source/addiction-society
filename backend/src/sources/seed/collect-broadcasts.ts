/**
 * 연대기 「방송」 줄 수집 (SOC-R1 ■7) — 매일 예약이 하루 한 번 돌린다.
 *
 * 실행: npm run collect:broadcasts
 * 중독뉴스 공개 API 를 GET 으로만 읽는다(열쇠 0). 링크 기준 중복은
 * ON CONFLICT DO NOTHING 으로 건너뛴다 — 넣기만, 고치기·지우기 없음.
 * 주소: env ADDICTION_NEWS_API_URL (기본 중독뉴스 운영 주소).
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { DEFAULT_NEWS_API_URL, toBroadcastRows } from '../broadcast.util';

async function run() {
  const base = (
    process.env.ADDICTION_NEWS_API_URL?.trim() || DEFAULT_NEWS_API_URL
  ).replace(/\/+$/, '');
  const res = await fetch(`${base}/articles/latest?kind=broadcast&limit=50`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = toBroadcastRows(await res.json());

  const ds = AppDataSource;
  await ds.initialize();
  let inserted = 0;
  for (const r of rows) {
    const out: unknown = await ds.query(
      `INSERT INTO "broadcast_items" ("url", "title", "broadcaster", "published_at", "grade")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("url") DO NOTHING
       RETURNING "id"`,
      [r.url, r.title, r.broadcaster, r.publishedAt, r.grade],
    );
    if (Array.isArray(out) && out.length > 0) inserted++;
  }
  console.log(
    `[collect:broadcasts] 받음 ${rows.length}건 · 새로 넣음 ${inserted}건 (링크 중복 건너뜀)`,
  );
  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect:broadcasts] 실패:', e);
  process.exit(1);
});
