import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * observations 유니크 키에 qualifier 추가 (AS-M3-2). 배포 preDeploy가 자동 실행.
 *
 * 배경(AS-M3-2a 설계 발견): 분해(성별·학교급 등)를 qualifier에 담으려면, 유니크 키
 * (indicator_id, source_id, geo, period)에 qualifier가 없어 같은 (지표·지역·기간)의
 * 분해 행들이 충돌한다. → qualifier를 키에 포함한다.
 *
 * NULL 문제: postgres 유니크 인덱스에서 NULL은 서로 구별되어(중복 허용) 멱등성이 깨진다.
 * → 전체값 행은 sentinel 'total'로 통일(NULL 금지). 기존 NULL을 'total'로 백필하고
 *   기본값 'total' + NOT NULL로 바꾼 뒤 키를 재생성한다.
 */
export class ObservationQualifierKey1785300000000 implements MigrationInterface {
  name = 'ObservationQualifierKey1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "observations" SET "qualifier" = 'total' WHERE "qualifier" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ALTER COLUMN "qualifier" SET DEFAULT 'total'`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ALTER COLUMN "qualifier" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_obs_series_unique"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_obs_series_unique" ON "observations" ("indicator_id", "source_id", "geo", "period", "qualifier")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_obs_series_unique"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_obs_series_unique" ON "observations" ("indicator_id", "source_id", "geo", "period")`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ALTER COLUMN "qualifier" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ALTER COLUMN "qualifier" DROP DEFAULT`,
    );
  }
}
