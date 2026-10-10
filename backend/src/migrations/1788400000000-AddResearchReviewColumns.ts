import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * research 검수·관련성 칸 (SOC-R1) — 덧붙임만.
 *
 *  - reviewed_by / reviewed_at / review_decision('keep'|'hide')
 *      : 관문에 걸린 승인분을 오너가 검수 창에서 살리거나 숨긴 기록.
 *  - relevance_score / relevance_reason / relevance_checked_at
 *      : 관련성 관문 판정 결과. collect:research 신규분은 저장 때,
 *        기존 행은 매일 예약이 처음 돌 때 한 번 채운다.
 *
 * 전부 NULL 허용·기본값 없음 → 기존 행 값 변경 0 · 데이터 이동 0.
 * status 칸은 건드리지 않는다.
 */
export class AddResearchReviewColumns1788400000000 implements MigrationInterface {
  name = 'AddResearchReviewColumns1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "research"
        ADD COLUMN IF NOT EXISTS "reviewed_by" text NULL,
        ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "review_decision" text NULL,
        ADD COLUMN IF NOT EXISTS "relevance_score" numeric NULL,
        ADD COLUMN IF NOT EXISTS "relevance_reason" text NULL,
        ADD COLUMN IF NOT EXISTS "relevance_checked_at" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "research"
        DROP COLUMN IF EXISTS "relevance_checked_at",
        DROP COLUMN IF EXISTS "relevance_reason",
        DROP COLUMN IF EXISTS "relevance_score",
        DROP COLUMN IF EXISTS "review_decision",
        DROP COLUMN IF EXISTS "reviewed_at",
        DROP COLUMN IF EXISTS "reviewed_by"
    `);
  }
}
