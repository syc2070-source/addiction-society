/**
 * 기존 research 행의 relevance_* 보충 (SOC-R1).
 *
 * 실행: npm run backfill:relevance  (매일 예약이 collect:research 뒤에 돌린다)
 *
 * relevance_checked_at IS NULL 인 행만 대상 → 처음 한 번만 실제로 쓰고, 이후엔 0건.
 * 쓰는 칸은 relevance_score · relevance_reason · relevance_checked_at 셋뿐이다
 * (status·review_*·updated_at 포함 다른 칸 0 — 그래서 원시 SQL 로 쓴다).
 */
import 'reflect-metadata';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { Research } from '../entities/research.entity';
import { relevanceColumns } from '../relevance';

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const rows = await ds.getRepository(Research).find({
    where: { relevanceCheckedAt: IsNull() },
    select: { id: true, title: true, abstract: true, keywords: true },
  });
  const at = new Date();
  let written = 0;
  for (const r of rows) {
    const c = relevanceColumns(r, at);
    const res: unknown = await ds.query(
      `UPDATE "research"
          SET "relevance_score" = $1, "relevance_reason" = $2, "relevance_checked_at" = $3
        WHERE "id" = $4 AND "relevance_checked_at" IS NULL`,
      [c.relevanceScore, c.relevanceReason, c.relevanceCheckedAt, r.id],
    );
    // pg 드라이버: [rows, affectedCount]
    if (Array.isArray(res) && Number(res[1]) > 0) written++;
  }
  console.log(
    `[backfill:relevance] 대상 ${rows.length}건 · 기록 ${written}건 (relevance_* 세 칸만)`,
  );
  await ds.destroy();
}

run().catch((e) => {
  console.error('[backfill:relevance] 실패:', e);
  process.exit(1);
});
