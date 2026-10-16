import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  SOURCE_URL_FIXES_R6,
  fixEventSql,
  fixUpdateSql,
  updatedCount,
} from '../sources/source-url-fixes';

/**
 * 감시 URL 수정 (SOC-R6 ■1) — 스키마 변경 0, 출처 2행의 감시 설정만.
 * kocca_game → kocca.kr 연구보고서 게시판 검색 목록(+게시판 셀렉터) ·
 * euda_statbulletin → 통계공보 고유 주소. 옛 주소일 때만 바꾸고(멱등), 바꾼 행마다
 * source_events 에 source_updated{from,to,reason} 를 남긴다. 기준선과 lastCheckedAt 을
 * 비워 다음 09:00 감시가 첫 읽기로 새 기준선을 잡는다. 관측치·지표 변경 0.
 */
export class FixSourceMonitorUrls1788600000000 implements MigrationInterface {
  name = 'FixSourceMonitorUrls1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const f of SOURCE_URL_FIXES_R6) {
      const [sql, params] = fixUpdateSql(f);
      const res: unknown = await queryRunner.query(sql, params);
      if (updatedCount(res) === 0) continue; // 이미 고쳤거나 다른 값 — 사건도 남기지 않음
      const [ev, evParams] = fixEventSql(f);
      await queryRunner.query(ev, evParams);
    }
  }

  public async down(): Promise<void> {
    // 감시 설정 되돌리기는 하지 않는다(옛 주소는 「바뀜」을 볼 수 없는 주소) — 사건 기록이 이력.
  }
}
