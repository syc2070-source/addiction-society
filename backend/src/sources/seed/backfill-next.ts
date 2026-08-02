/**
 * next_expected_at 재계산 (M2-1 백필 → AS-M3-FIX-DATE 상시 교정).
 *
 * 실행: npm run backfill:next  (deploy-init.sh 4/4에서 매 배포마다 호출)
 *
 * 전 소스의 next_expected_at을 computeNextExpected로 다시 계산한다. 계산은
 * 결정적이므로 몇 번을 돌려도 같은 값이 나온다(멱등).
 *
 * AS-M3-FIX-DATE 변경점:
 *  - 값이 실제로 바뀌는 행만 UPDATE 한다(불필요한 쓰기 제거).
 *  - 지난 예정일을 이월한 경우 source_events에 rescheduled로 남긴다.
 *    배포 시점의 교정도 "예정일이 언제 어떻게 바뀌었나"의 이력이다(원칙 11).
 *    크론(sources.scheduler.reconcileExpected)이 남기는 이벤트와 같은 형식이며,
 *    detail.by로 어느 경로가 이월했는지 구분한다.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Source } from '../entities/source.entity';
import { SourceEvent } from '../entities/source-event.entity';
import { computeNextExpected, isExpectedOverdue } from '../next-expected.util';

async function run() {
  // 공용 AppDataSource 재사용(synchronize:false). 스키마는 마이그레이션이 담당.
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(Source);
  const eventRepo = ds.getRepository(SourceEvent);
  const sources = await repo.find();

  const today = new Date();
  const byCadence: Record<string, { filled: number; nulled: number }> = {};
  const changes: { id: string; from: string | null; to: string | null }[] = [];
  const rolled: string[] = [];
  let filledTotal = 0;

  for (const s of sources) {
    const from = s.nextExpectedAt ?? null;
    const next = computeNextExpected(s, today);

    byCadence[s.cadence] ??= { filled: 0, nulled: 0 };
    if (next) {
      byCadence[s.cadence].filled++;
      filledTotal++;
    } else {
      byCadence[s.cadence].nulled++;
    }

    if (next === from) continue; // 변화 없음 → 쓰지 않는다

    await repo.update(s.id, { nextExpectedAt: next });
    changes.push({ id: s.id, from, to: next });

    // 지난 예정일을 넘긴 경우만 이벤트로 남긴다.
    // (null → 최초 채움은 '이월'이 아니라 초기 백필이므로 제외)
    if (isExpectedOverdue(from, today)) {
      await eventRepo.save(
        eventRepo.create({
          sourceId: s.id,
          eventType: 'rescheduled',
          detail: {
            from,
            to: next,
            reason: 'overdue',
            publicationConfirmed: false,
            by: 'backfill',
          },
          notified: false,
        }),
      );
      rolled.push(s.id);
    }
  }

  console.log(
    `[backfill] 전체 ${sources.length}건 중 채움 ${filledTotal} / null ${sources.length - filledTotal}`,
  );
  console.log('[backfill] cadence별:', JSON.stringify(byCadence));
  console.log(
    `[backfill] 값이 바뀐 행 ${changes.length}건:`,
    JSON.stringify(changes),
  );
  console.log(
    `[backfill] 지난 예정일 이월 ${rolled.length}건:`,
    JSON.stringify(rolled),
  );

  await ds.destroy();
}

run().catch((e) => {
  console.error('[backfill] 실패:', e);
  process.exit(1);
});
