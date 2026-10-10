import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * broadcast_items 새 표 (SOC-R1 ■7) — 연대기 「방송」 줄. 기존 표 변경 0.
 */
export class CreateBroadcastItems1788400000001 implements MigrationInterface {
  name = 'CreateBroadcastItems1788400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "broadcast_items" (
        "id" SERIAL PRIMARY KEY,
        "url" text NOT NULL UNIQUE,
        "title" text NOT NULL,
        "broadcaster" text NULL,
        "published_at" timestamptz NULL,
        "grade" text NOT NULL DEFAULT '방송',
        "fetched_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_broadcast_items_published_at" ON "broadcast_items" ("published_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_broadcast_items_published_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "broadcast_items"`);
  }
}
