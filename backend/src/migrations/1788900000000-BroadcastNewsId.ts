import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * broadcast_items 칸 하나 덧붙임 (SOC-R13 ■3) — 기존 칸·행 지움 0 · 값 채움 0.
 *  - news_id: 중독뉴스 articles.id. 중독뉴스 방송 보관 목록(NEWS-Q14 ■5)은 id · tier · 바뀐 때만 싣고
 *    링크가 없어, 우리 행과 잇는 열쇠가 이것이다. collect:broadcasts 가 방송 목록(id · sourceUrl)에서 채운다.
 */
export class BroadcastNewsId1788900000000 implements MigrationInterface {
  name = 'BroadcastNewsId1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "news_id" integer NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_items" DROP COLUMN IF EXISTS "news_id"`,
    );
  }
}
