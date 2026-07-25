import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ⚠️ 초안(DRAFT) — AS-M3-0. **아직 실행하지 않는다.**
 *
 * 이 파일은 `src/migrations/drafts/`에 있으므로 data-source.ts의 마이그레이션 glob
 * (`src/migrations/*.ts`, 비재귀)에 잡히지 않는다. 따라서 배포(deploy-init의
 * `npm run migration:run`)에서도 자동 실행되지 않는다 — 설계 검토용 산출물이다.
 *
 * M3-1 활성화 방법:
 *   1) 이 파일을 `src/migrations/`로 이동(한 단계 위).
 *   2) `npm run migration:run` (또는 배포 시 preDeployCommand가 자동 실행).
 *   3) 이어서 indicators 시드 + collect:observations 수집 스크립트 실행.
 *
 * indicators(정의·단위·출처 메타) + observations(append-only 시계열) 두 테이블 생성.
 * source_id는 sources(text PK) FK, ON DELETE SET NULL(문서/지표 보존, 링크만 해제).
 * observations는 (indicator_id, source_id, geo, period, fetched_at) 유니크로 append-only.
 */
export class CreateIndicatorsAndObservations1785000000000 implements MigrationInterface {
  name = 'CreateIndicatorsAndObservations1785000000000';

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

    // ── observations (append-only) ──
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
      "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "source_url" character varying(500) NOT NULL,
      CONSTRAINT "PK_observations" PRIMARY KEY ("id")
    )`);
    // append-only 보존 키: 같은 (지표·소스·지역·기간)이라도 수집 시점이 다르면 새 행.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_obs_series_unique" ON "observations" ("indicator_id", "source_id", "geo", "period", "fetched_at")`,
    );
    // 표시용 조회 인덱스(지표·지역·기간별 최신 fetched_at 선택).
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
