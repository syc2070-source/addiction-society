import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecoverySourceUrl1784610789761 implements MigrationInterface {
    name = 'AddRecoverySourceUrl1784610789761'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recovery_resources" ADD "source_url" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recovery_resources" DROP COLUMN "source_url"`);
    }

}
