/**
 * next_expected_at 재계산 (M2-1 백필 → AS-M3-FIX-DATE 상시 교정).
 *
 * 실행: npm run backfill:next  (매일 04:00 KST 예약이 seed:sources 바로 뒤에 호출 — SOC-R1)
 *
 * SOC-R8 ■2: 다시 계산하지 않는다 — next-expected.util backfillPlan. 비어 있으면 채우고,
 * 예정 달이 끝나기 전엔 건드리지 않고, 끝났으면 rescheduled 와 함께 다음 예정으로.
 * SOC-R17 ■3: 달 경계 KST 뒤로 「끝났으면 이월」은 여기서 하지 않는다 — 09:00 감시가 읽은 뒤
 * reconcileExpected 가 한다(읽기 먼저 · 연간 출처가 감시 창 밖으로 밀리지 않게). 여기는 빈 값 채움만.
 * (전에는 매일 전 소스를 computeNextExpected 로 덮어 이번 달 예정이 달 초에 사건 없이
 * 다음 달로 넘어갔다.) 멱등은 그대로.
 *
 * AS-M3-FIX-DATE 변경점:
 *  - 값이 실제로 바뀌는 행만 UPDATE 한다(불필요한 쓰기 제거).
 *  - 지난 예정일을 이월한 경우 source_events에 rescheduled로 남긴다.
 *    배포 시점의 교정도 "예정일이 언제 어떻게 바뀌었나"의 이력이다(원칙 11).
 *    크론(sources.scheduler.reconcileExpected)이 남기는 이벤트와 같은 형식이며,
 *    detail.by로 어느 경로가 이월했는지 구분한다.
 *
 * SOC-R3 ■4: 지난 예정(예정 월이 끝남) 수를 로그로 — 주기 있음은 주기만큼 앞으로,
 *  주기 없음은 「확인 필요」(null, 지어내지 않음). 「지남」은 월 단위(그 달 말일까지는
 *  지나지 않음). 화면의 「지난 예정 · 미확인」 줄은 GET /api/sources/calendar/missed.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Source } from '../entities/source.entity';
import { backfillPlan, isExpectedOverdue } from '../next-expected.util';
import { printJobCounts } from '../../common/job-counts';
import { overdueAction } from '../missed-releases';

async function run() {
  // 공용 AppDataSource 재사용(synchronize:false). 스키마는 마이그레이션이 담당.
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(Source);
  const sources = await repo.find();

  const today = new Date();
  const byCadence: Record<string, { filled: number; nulled: number }> = {};
  const changes: { id: string; from: string | null; to: string | null }[] = [];
  /** 이월할 때가 됐지만 09:00 감시 뒤로 미룬 것 */
  const deferred: string[] = [];
  // SOC-R3 ■4: 지난 예정(그 달이 끝남)을 주기 있음/없음으로 나눠 센다.
  const overdue: { id: string; from: string; to: string | null }[] = [];
  const needsCheck: string[] = [];
  let filledTotal = 0;

  for (const s of sources) {
    const from = s.nextExpectedAt ?? null;
    const plan = backfillPlan(s, today);
    // 미룬 이월(plan.rolled)은 쓰지 않으므로 기록도 지금 값으로(반박 2)
    const next = plan && !plan.rolled ? plan.to : from;
    if (from && isExpectedOverdue(from, today)) {
      // 09:00 이월이 갈 곳(미리 보기 · 여기서는 쓰지 않음)
      const target = plan ? plan.to : from;
      overdue.push({ id: s.id, from, to: target });
      if (overdueAction(s) === 'check' || !target) needsCheck.push(s.id);
    }

    byCadence[s.cadence] ??= { filled: 0, nulled: 0 };
    if (next) {
      byCadence[s.cadence].filled++;
      filledTotal++;
    } else {
      byCadence[s.cadence].nulled++;
    }

    if (!plan) continue; // 변화 없음 · 달 안 → 쓰지 않는다

    // SOC-R17 ■3(리뷰 B1): 달 경계가 KST 라 04:00 에 이미 「지난 예정」이 선다 — 여기서 이월하면 연간 출처가
    // 09:00 감시의 30일 창 밖으로 밀려 달 끝 읽기를 못 받는다(hri_gshr 12-01 · kocca_game 01-01).
    // 이월은 09:00 감시가 먼저 읽은 뒤(sources.scheduler reconcileExpected)에만 — 여기서는 빈 값 채움만.
    if (plan.rolled) {
      deferred.push(s.id);
      continue;
    }

    await repo.update(s.id, { nextExpectedAt: next });
    changes.push({ id: s.id, from, to: next });
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
    `[backfill] 지난 예정일 이월 0건 · 09:00 감시 뒤로 미룸 ${deferred.length}건:`,
    JSON.stringify(deferred),
  );
  console.log(
    `[backfill] 지난 예정 ${overdue.length}건 · 주기만큼 앞으로 ${overdue.length - needsCheck.length} · 확인 필요 ${needsCheck.length}:`,
    JSON.stringify({ overdue, needsCheck }),
  );
  printJobCounts({
    updated: changes.length,
    skipped: sources.length - changes.length,
  });

  await ds.destroy();
}

run().catch((e) => {
  console.error('[backfill] 실패:', e);
  process.exit(1);
});
