import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * documents.source_id 추가 (AS-FILL-2).
 *
 * sources 레지스트리와 정책문서를 연계하기 위한 nullable FK.
 * sources.id는 text 기본키(사람이 읽는 문자열)이므로 컬럼도 text.
 * 소스 삭제 시 문서를 지우지 않고 링크만 끊도록 ON DELETE SET NULL.
 * 기존 문서는 전부 NULL(수기 입력분) — additive 마이그레이션이라 영향 없음.
 */
export class AddDocumentSourceId1784700000001 implements MigrationInterface {
  name = 'AddDocumentSourceId1784700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" ADD "source_id" text`);
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_source_id"`,
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "source_id"`);
  }
}
