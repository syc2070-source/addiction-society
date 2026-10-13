import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * job_runs 새 표 (SOC-R3 ■1) — 매일 04:00 예약이 무엇을 했는지 숫자로 남긴다.
 * 회차 시작·끝 행 + 단계마다 행(넣기만). 기존 표 변경 0.
 */
export class CreateJobRuns1788500000000 implements MigrationInterface {
  name = 'CreateJobRuns1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_runs" (
        "id" SERIAL PRIMARY KEY,
        "run_id" varchar(40) NOT NULL,
        "started_at" timestamptz NOT NULL,
        "finished_at" timestamptz NULL,
        "step" varchar(60) NOT NULL,
        "status" varchar(10) NOT NULL,
        "counts" jsonb NULL,
        "error" varchar(300) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_runs_run_id" ON "job_runs" ("run_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_runs_started_at" ON "job_runs" ("started_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_runs_started_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_job_runs_run_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_runs"`);
  }
}
