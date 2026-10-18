import { MigrationInterface, QueryRunner } from 'typeorm';
import { hriEventSql, hriFixSql } from '../sources/monitor-method-fixes';
import { updatedCount } from '../sources/source-url-fixes';

/**
 * hri_gshr 감시 방식 Last-Modified → 본문 해시 (SOC-R8 ■3) — 스키마 변경 0, 출처 1행의
 * 감시 설정만. 아직 detect 가 없을 때만 바꾸고(멱등) source_updated 를 남긴다.
 */
export class HriHashMonitor1788700000002 implements MigrationInterface {
  name = 'HriHashMonitor1788700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [sql, params] = hriFixSql();
    if (updatedCount(await queryRunner.query(sql, params)) === 0) return;
    const [ev, evParams] = hriEventSql();
    await queryRunner.query(ev, evParams);
  }

  public async down(): Promise<void> {
    // 되돌리지 않는다(흔들리는 검증자) — 사건 기록이 이력.
  }
}
