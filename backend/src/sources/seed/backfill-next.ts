/**
 * next_expected_at 1회 백필 (M2-1).
 *
 * 실행: npm run backfill:next
 *
 * 시딩 직후 전 소스는 next_expected_at=null 이다. computeNextExpected로 계산해
 * 채운다. 전용 DataSource(entities:[Source], synchronize:true)이므로 M2에서 추가한
 * last_modified/fail_count 컬럼도 이때 함께 생성되며, sources 외 테이블은 건드리지 않는다.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Source } from '../entities/source.entity';
import { computeNextExpected } from '../next-expected.util';

async function run() {
  // 공용 AppDataSource 재사용(synchronize:false). 스키마는 마이그레이션이 담당.
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(Source);
  const sources = await repo.find();

  const today = new Date();
  const byCadence: Record<string, { filled: number; nulled: number }> = {};
  const samples: { id: string; cadence: string; next: string | null }[] = [];

  for (const s of sources) {
    const next = computeNextExpected(s, today);
    await repo.update(s.id, { nextExpectedAt: next });

    byCadence[s.cadence] ??= { filled: 0, nulled: 0 };
    if (next) byCadence[s.cadence].filled++;
    else byCadence[s.cadence].nulled++;

    if (next) samples.push({ id: s.id, cadence: s.cadence, next });
  }

  const filledTotal = samples.length;
  console.log(`[backfill] 전체 ${sources.length}건 중 채움 ${filledTotal} / null ${sources.length - filledTotal}`);
  console.log('[backfill] cadence별:', JSON.stringify(byCadence));
  console.log('[backfill] 채워진 샘플:', JSON.stringify(samples));

  await ds.destroy();
}

run().catch((e) => {
  console.error('[backfill] 실패:', e);
  process.exit(1);
});
