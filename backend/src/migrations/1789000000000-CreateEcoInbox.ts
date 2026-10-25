import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * eco_inbox 새 표 (SOC-R15 ■4 · ECO-LINK1 계약 v1.4 §6-3) — Statory 카드 · 중독뉴스 기사를 받는 표.
 * 기존 표 변경 0 · 값 채움 0. 받는 문 스위치(ECO_LINK1_INBOX_ENABLED)가 꺼져 있으면 비어 있다.
 *  - 한 줄 = 받은 것 하나의 한 판: (origin, slug, version) 유일 · 중독뉴스는 판이 없어 version = ''.
 *  - paper_key = 결정 상속 열쇠(Statory `paper:<paper_id>` · 옛 꼴 `card:<card_id>` · 중독뉴스 = slug) · 색인(유일 아님).
 *  - key_moved_from · key_moved_at = C2(SOC-R15 ■2) 옛 card 열쇠를 paper 열쇠로 옮겨 적은 기록(옛 줄 지움 0).
 *  - keep_from_version = 물려받은 keep 의 원래 판(관리자 화면 「이전 판 승인」 꼬리표 · 손님 응답에는 싣지 않음 · C1).
 */
export class CreateEcoInbox1789000000000 implements MigrationInterface {
  name = 'CreateEcoInbox1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eco_inbox" (
        "id" SERIAL PRIMARY KEY,
        "origin" text NOT NULL,
        "slug" text NOT NULL,
        "version" text NOT NULL DEFAULT '',
        "paper_key" text NOT NULL,
        "title" text NOT NULL,
        "url" text NULL,
        "grade" text NOT NULL,
        "kind" text NOT NULL,
        "subtype" jsonb NOT NULL DEFAULT '[]',
        "topic" text NULL,
        "licence" text NULL,
        "licence_use" text NULL,
        "missing" jsonb NULL,
        "payload" jsonb NOT NULL,
        "source_generated_at" timestamptz NULL,
        "upstream" text NOT NULL DEFAULT 'public',
        "review_decision" text NULL,
        "reviewed_by" text NULL,
        "reviewed_at" timestamptz NULL,
        "keep_from_version" text NULL,
        "key_moved_from" text NULL,
        "key_moved_at" timestamptz NULL,
        "fetched_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_eco_inbox_origin_slug_version" UNIQUE ("origin", "slug", "version")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_eco_inbox_paper_key" ON "eco_inbox" ("origin", "paper_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eco_inbox_paper_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "eco_inbox"`);
  }
}
