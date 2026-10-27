import { MigrationInterface, QueryRunner } from 'typeorm';
import { updatedCount } from '../sources/source-url-fixes';

/**
 * DOI 만 있는 KCI 카드의 링크 소급 (SOC-R18 ■1 · 계약 v1.8 §6-5) — 이미 받은 행 가운데
 * origin statory · payload.source = kci · url 빈 칸 · payload.doi 가 링크 꼴(eco-inbox DOI_LINK_RE 와 같은 꼴)인 것만
 * url = https://doi.org/<DOI> 로 한 번 채운다. 결정 · upstream · payload · missing 칸은 건드리지 않음 · 지움 0.
 * 받는 문 스위치(ECO_LINK1_INBOX_ENABLED)가 꺼져 있던 동안은 표가 비어 있어 0건이 정상. 채운 수는 로그로.
 * 멱등(두 번째부터 url 이 차 있어 0건). DOI 는 앞뒤 빈칸을 떼고 잰다(받는 문 text() 와 같음 · payload 는 원문 그대로라 · 리뷰 A1).
 */
const DOI_LINK_SQL = '^10\\.[0-9]{4,9}/[-._;()/:A-Za-z0-9]+$';

export class KciDoiLink1789100000000 implements MigrationInterface {
  name = 'KciDoiLink1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const res: unknown = await queryRunner.query(
      `UPDATE "eco_inbox"
          SET "url" = 'https://doi.org/' || btrim("payload"->>'doi')
        WHERE "origin" = 'statory'
          AND "url" IS NULL
          AND lower(btrim("payload"->>'source')) = 'kci'
          AND btrim("payload"->>'doi') ~ $1
        RETURNING "id"`,
      [DOI_LINK_SQL],
    );
    console.log(`[migration] KCI DOI 링크 소급 ${updatedCount(res)}건`);
  }

  public async down(): Promise<void> {
    // 채운 링크를 다시 비우지 않는다(지움 0 · 사람이 본 링크일 수 있음)
  }
}
