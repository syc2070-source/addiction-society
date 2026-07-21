import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLastNotifiedAt1784606983816 implements MigrationInterface {
    name = 'AddLastNotifiedAt1784606983816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sources" ADD "last_notified_at" TIMESTAMP WITH TIME ZONE`);
        // M2.6에서 해시 산출 방식이 바뀜(본문 정규화 + 게시판형은 최신글 해시).
        // 구방식 baseline과 비교하면 전 소스가 '변경'으로 오탐되므로 리셋한다.
        // null이면 다음 감시 때 기준값만 저장하고 알림은 나가지 않는다.
        await queryRunner.query(`UPDATE "sources" SET "content_hash" = NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "last_notified_at"`);
    }

}
