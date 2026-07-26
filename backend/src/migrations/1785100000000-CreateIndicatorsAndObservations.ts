import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * indicators + observations 생성 (AS-M3-1). 배포 preDeploy(migration:run)가 자동 실행.
 *
 * indicators: 지표 메타(정의·단위·출처). definition_ko NOT NULL(원칙4).
 * observations: 시계열 값. source_url NOT NULL(원칙3).
 *   재수집 정책 = upsert + revisions(감사). 유니크 키 (indicator_id, source_id, geo, period)
 *   — fetched_at 제외 → 재수집이 중복 행을 만들지 않는다. 값 변경분은 revisions(jsonb)에 누적.
 * source_id는 sources(text PK) FK, ON DELETE SET NULL(문서/지표 보존, 링크만 해제).
 */
export class CreateIndicatorsAndObservations1785100000000 implements MigrationInterface {
  name = 'CreateIndicatorsAndObservations1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── indicators ──
    await queryRunner.query(`CREATE TABLE "indicators" (
      "id" SERIAL NOT NULL,
      "code" character varying(100) NOT NULL,
      "domain" character varying(20) NOT NULL,
      "name_ko" character varying(300) NOT NULL,
      "name_en" character varying(300),
      "unit" character varying(100),
      "definition_ko" text NOT NULL,
      "method_note" text,
      "source_id" text,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_indicators" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_indicators_code" ON "indicators" ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "indicators" ADD CONSTRAINT "FK_indicators_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // ── observations ──
    await queryRunner.query(`CREATE TABLE "observations" (
      "id" SERIAL NOT NULL,
      "indicator_id" integer NOT NULL,
      "source_id" text,
      "geo" character varying(20) NOT NULL,
      "period" character varying(20) NOT NULL,
      "value" numeric NOT NULL,
      "value_low" numeric,
      "value_high" numeric,
      "qualifier" character varying(100),
      "revisions" jsonb,
      "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "source_url" character varying(500) NOT NULL,
      CONSTRAINT "PK_observations" PRIMARY KEY ("id")
    )`);
    // 시계열 보존 키(fetched_at 제외): (지표·소스·지역·기간)당 한 행 → 재수집 멱등.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_obs_series_unique" ON "observations" ("indicator_id", "source_id", "geo", "period")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_obs_indicator_geo_period" ON "observations" ("indicator_id", "geo", "period")`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ADD CONSTRAINT "FK_observations_indicator_id" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ADD CONSTRAINT "FK_observations_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "observations" DROP CONSTRAINT "FK_observations_source_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" DROP CONSTRAINT "FK_observations_indicator_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_obs_indicator_geo_period"`);
    await queryRunner.query(`DROP INDEX "IDX_obs_series_unique"`);
    await queryRunner.query(`DROP TABLE "observations"`);
    await queryRunner.query(
      `ALTER TABLE "indicators" DROP CONSTRAINT "FK_indicators_source_id"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_indicators_code"`);
    await queryRunner.query(`DROP TABLE "indicators"`);
  }
}
