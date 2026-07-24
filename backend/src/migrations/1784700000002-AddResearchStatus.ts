import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * research.status 추가 (AS-FILL-2).
 *
 * 학술 API 자동수집분을 공개 전에 검토(승인)하기 위한 상태 컬럼.
 *  - 'approved' : 공개 페이지 노출 대상 (기존 행은 default로 전부 approved →
 *                 현재 노출 상태 그대로 유지, 비파괴적 additive)
 *  - 'pending'  : collect:research 수집분 초기값. 검토 후 SQL로 승인 전환.
 * 공개 API(findAll/featured)는 approved만 반환한다(블루프린트 원칙 8).
 */
export class AddResearchStatus1784700000002 implements MigrationInterface {
  name = 'AddResearchStatus1784700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "research" ADD "status" character varying(20) NOT NULL DEFAULT 'approved'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_research_status" ON "research" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_research_status"`);
    await queryRunner.query(`ALTER TABLE "research" DROP COLUMN "status"`);
  }
}
