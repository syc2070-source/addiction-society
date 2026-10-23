import { MigrationInterface, QueryRunner } from 'typeorm';
import { BROADCAST_SOURCE_EN } from '../sources/broadcast-names';

/**
 * broadcast_items 칸 셋 덧붙임 (SOC-R12 ■1 ■2) — 기존 칸·행 지움 0.
 *  - source_en: 방송 영어 이름(중독뉴스 program_en 정본). 기존 행은 비어 있을 때만 정본 표로 채운다.
 *  - hidden_reason · hidden_at: 연대기 공개에서 내린 까닭·시각(source_archived = 중독뉴스가 보관으로 옮김).
 *    행은 남는다 — 다시 실리면 collect:broadcasts 가 두 칸을 비워 다시 보인다.
 */
export class BroadcastSourceEnAndHidden1788800000000 implements MigrationInterface {
  name = 'BroadcastSourceEnAndHidden1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "source_en" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "hidden_reason" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "hidden_at" timestamptz NULL`,
    );
    for (const [program, en] of Object.entries(BROADCAST_SOURCE_EN)) {
      await queryRunner.query(
        `UPDATE "broadcast_items" SET "source_en" = $2 WHERE "broadcaster" = $1 AND "source_en" IS NULL`,
        [program, en],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" DROP COLUMN IF EXISTS "hidden_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" DROP COLUMN IF EXISTS "hidden_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" DROP COLUMN IF EXISTS "source_en"`,
    );
  }
}
