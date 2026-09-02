import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultUserRole1788300000000 implements MigrationInterface {
  name = 'DefaultUserRole1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer'`,
    );
  }
}
