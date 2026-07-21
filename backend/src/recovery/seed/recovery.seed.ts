/**
 * 회복자원 전국 디렉토리 시드 (AS-FILL-1).
 *
 * 실행: npm run seed:recovery
 *
 * 데이터: recovery-directory.data.json (공공 페이지 파싱 결과, 출처 URL 포함)
 *  - 보건복지부 중독관리통합지원센터 운영 및 현황 63개소
 *    https://www.mohw.go.kr/menu.es?mid=a10706040400 (페이지 최종수정 2026-03-06)
 *  - 스마트쉼센터 상담기관안내 10개소
 *    https://www.iapc.or.kr/agencyList.do?idx=124&type=A
 *
 * 멱등성: name 기준 upsert(있으면 갱신, 없으면 삽입). 기존 수기 5건은 건드리지 않는다.
 * deploy-init에는 태우지 않는다 — 매 배포마다 돌 필요 없는 대형 시드라서.
 * 운영 반영: Render Shell(또는 로컬에서 운영 DB env로) `npm run seed:recovery` 1회.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { RecoveryResource } from '../entities/recovery-resource.entity';
import directory from './recovery-directory.data.json';

interface DirectoryRow {
  name: string;
  type: string;
  domains: string[];
  description: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string;
}

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(RecoveryResource);

  const before = await repo.count();
  let inserted = 0;
  let updated = 0;

  for (const row of directory.resources as DirectoryRow[]) {
    const existing = await repo.findOne({ where: { name: row.name } });
    const payload = {
      name: row.name,
      type: row.type as RecoveryResource['type'],
      domains: row.domains as RecoveryResource['domains'],
      description: row.description,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      phone: row.phone ?? undefined,
      website: row.website ?? undefined,
      sourceUrl: row.sourceUrl,
      region: 'KR' as RecoveryResource['region'],
      // 공공 공식 목록 출처이므로 인증 표시. 연 1회 재크롤링으로 갱신(블루프린트 P6)
      isVerified: true,
      isActive: true,
    };
    if (existing) {
      await repo.update(existing.id, payload);
      updated++;
    } else {
      await repo.save(repo.create(payload));
      inserted++;
    }
  }

  const after = await repo.count();
  console.log(
    `[seed:recovery] 디렉토리 ${directory.resources.length}건 → 신규 ${inserted} / 갱신 ${updated}`,
  );
  console.log(`[seed:recovery] 테이블 총량 ${before} → ${after}건`);
  console.log(
    '[seed:recovery] 출처:',
    (directory.sources as { name: string; url: string }[])
      .map((s) => `${s.name} <${s.url}>`)
      .join(' / '),
  );

  await ds.destroy();
}

run().catch((e) => {
  console.error('[seed:recovery] 실패:', e);
  process.exit(1);
});
