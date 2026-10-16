import { MigrationInterface, QueryRunner } from 'typeorm';
import { INDICATOR_BREAK_YEARS } from '../indicators/break-years';

/**
 * indicators.break_years int[] 열 덧붙임 (SOC-R6 ■2) — 조사 설계 변경 해.
 * 기존 지표 4행은 비어 있을 때만 채운다(멱등 · 관리자 값이 있으면 그대로). 관측치 변경 0.
 */
export class AddIndicatorBreakYears1788600000001 implements MigrationInterface {
  name = 'AddIndicatorBreakYears1788600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "indicators" ADD COLUMN IF NOT EXISTS "break_years" integer[] NULL`,
    );
    for (const [code, years] of Object.entries(INDICATOR_BREAK_YEARS)) {
      await queryRunner.query(
        `UPDATE "indicators" SET "break_years" = $2::integer[] WHERE "code" = $1 AND "break_years" IS NULL`,
        [code, years],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "indicators" DROP COLUMN IF EXISTS "break_years"`,
    );
  }
}
