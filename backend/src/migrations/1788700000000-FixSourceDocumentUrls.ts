import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DOCUMENT_URL_FIXES_R8,
  documentEventSql,
  documentFixSql,
  returnedIds,
} from '../policy/document-url-fixes';

/**
 * 대표 문서 주소 수정 (SOC-R8 ■1) — 스키마 변경 0, 문서 2행의 source_url 만.
 * kocca_game · euda_statbulletin 대표 문서를 SOC-R6 감시 URL 과 같게. 옛 주소일 때만
 * 바꾸고(멱등), 바꾼 문서마다 source_events 에 document_updated 를 남긴다.
 */
export class FixSourceDocumentUrls1788700000000 implements MigrationInterface {
  name = 'FixSourceDocumentUrls1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const f of DOCUMENT_URL_FIXES_R8) {
      const [sql, params] = documentFixSql(f);
      const ids = returnedIds(await queryRunner.query(sql, params));
      for (const id of ids) {
        const [ev, evParams] = documentEventSql(f, id);
        await queryRunner.query(ev, evParams);
      }
    }
  }

  public async down(): Promise<void> {
    // 옛 주소로 되돌리지 않는다(무관한 페이지) — 사건 기록이 이력.
  }
}
