import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  EXPECTED_RESTORES_R8,
  restoreEventSql,
  restoreSql,
} from '../sources/expected-restore';
import { updatedCount } from '../sources/source-url-fixes';

/**
 * 사건 없이 밀린 10월 예정 되돌리기 (SOC-R8 ■2 ⓓ) — 스키마 변경 0.
 * drugfree_stats · spo_drug_monthly next_expected_at 2026-11-01 → 2026-10-01, 아직 11-01 이고
 * 10월 이후 발간이 없을 때만(멱등). 되돌린 행마다 rescheduled{reason:'restore'}.
 */
export class RestoreSkippedExpectedMonth1788700000001 implements MigrationInterface {
  name = 'RestoreSkippedExpectedMonth1788700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const r of EXPECTED_RESTORES_R8) {
      const [sql, params] = restoreSql(r);
      if (updatedCount(await queryRunner.query(sql, params)) === 0) continue;
      const [ev, evParams] = restoreEventSql(r);
      await queryRunner.query(ev, evParams);
    }
  }

  public async down(): Promise<void> {
    // 되돌리지 않는다 — 사건 기록이 이력.
  }
}
