import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * observations에 review_batch·note 추가 (AS-PDF-RUN).
 *
 * review_batch: PDF 추출 1회분을 묶는 식별자. Discord 검수 링크가 이 배치를
 *   통째로 승인/폐기한다. 관리자 UI 없이 알림만으로 검수를 끝내기 위한 최소 장치.
 *
 * note: 관측치별 단서. 특히 **조사대상 변경**을 담는다.
 *   kcgp 청소년 도박 실태조사는 회차마다 모집단이 바뀌었다
 *   (2015·2018 고3 제외 → 2020 고3 포함 → 2022 초등 포함 → 2024 국가승인통계로 개편).
 *   이 단서 없이 회차를 한 줄로 이으면 "6.4%에서 1.7%로 급감"처럼 읽히는데
 *   실제로는 모집단이 달라진 것이다. 원칙1(가짜 숫자 금지)의 연장선에서,
 *   숫자를 붙일 수 없으면 그 사실을 데이터에 함께 실어야 한다.
 *
 * 둘 다 nullable 추가 — 기존 행에 영향 없음(additive).
 */
export class ObservationReviewBatchAndNote1786600000000 implements MigrationInterface {
  name = 'ObservationReviewBatchAndNote1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "observations" ADD "review_batch" character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "observations" ADD "note" character varying(300)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_observations_review_batch" ON "observations" ("review_batch")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_observations_review_batch"`,
    );
    await queryRunner.query(`ALTER TABLE "observations" DROP COLUMN "note"`);
    await queryRunner.query(
      `ALTER TABLE "observations" DROP COLUMN "review_batch"`,
    );
  }
}
