import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * source_events 생성 (AS-M3-LEDGER, 원칙11). 배포 preDeploy가 자동 실행.
 *
 * 크론 감지·감시 이력의 append-only 기록. source_id는 sources FK(ON DELETE CASCADE:
 * 소스 자체가 삭제되면 그 이력도 함께 정리. 운영상 소스는 삭제 대신 status='dead'로 두므로
 * 실제 발생은 드물다). detected_at·source_id 인덱스로 타임라인 조회 최적화.
 */
export class CreateSourceEvents1785200000000 implements MigrationInterface {
  name = 'CreateSourceEvents1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "source_events" (
      "id" SERIAL NOT NULL,
      "source_id" text NOT NULL,
      "event_type" character varying(20) NOT NULL,
      "detected_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "prev_hash" text,
      "new_hash" text,
      "prev_published_at" date,
      "new_published_at" date,
      "detail" jsonb,
      "notified" boolean NOT NULL DEFAULT false,
      CONSTRAINT "PK_source_events" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_source_events_detected_at" ON "source_events" ("detected_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_events_source_id" ON "source_events" ("source_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_events" ADD CONSTRAINT "FK_source_events_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_events" DROP CONSTRAINT "FK_source_events_source_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_source_events_source_id"`);
    await queryRunner.query(`DROP INDEX "IDX_source_events_detected_at"`);
    await queryRunner.query(`DROP TABLE "source_events"`);
  }
}
