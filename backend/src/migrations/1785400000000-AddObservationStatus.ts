import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * observations.status 추가 (AS-M3-2b). 배포 preDeploy가 자동 실행.
 *
 * PDF 표 추출은 기계 오독 위험이 있어 자동 게시 금지 — 검수 필수(정관 2조: 수집 자동, 검수 사람).
 * FILL-2c의 서지 메타데이터(DOI 기계검증) 자동 게시와 구분되는 지점.
 *  - 'approved': 공개 노출(기존 큐레이션 값은 default로 전부 approved → 현행 유지, 비파괴적)
 *  - 'pending' : PDF 크론 추출분 초기값. 사람 검수 후 승인 전까지 비공개.
 */
export class AddObservationStatus1785400000000 implements MigrationInterface {
  name = 'AddObservationStatus1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "observations" ADD "status" character varying(20) NOT NULL DEFAULT 'approved'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_observations_status" ON "observations" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_observations_status"`);
    await queryRunner.query(`ALTER TABLE "observations" DROP COLUMN "status"`);
  }
}
