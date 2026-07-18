/**
 * 기본 태그 시드 (멱등).
 *
 * 실행: npm run seed:tags
 *
 * 기존 database/schema.sql의 tags INSERT 목록을 스크립트로 흡수한 것.
 * 신규 DB 구축 시 migration:run 다음에 실행하면 재현된다.
 * name이 unique 이므로 orIgnore(ON CONFLICT DO NOTHING)로 재실행 안전.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Tag } from '../../tags/entities/tag.entity';
import { TagType } from '../../common/enums';

const T = TagType.TOPIC;
const P = TagType.POLICY;

const TAGS: { name: string; type: TagType; description: string }[] = [
  { name: 'alcohol', type: T, description: '알코올' },
  { name: 'drug', type: T, description: '약물' },
  { name: 'opioid', type: T, description: '오피오이드' },
  { name: 'gambling', type: T, description: '도박' },
  { name: 'gaming', type: T, description: '게임' },
  { name: 'smartphone', type: T, description: '스마트폰' },
  { name: 'sns', type: T, description: 'SNS' },
  { name: 'ai', type: T, description: 'AI' },
  { name: 'shopping', type: T, description: '쇼핑' },
  { name: 'work', type: T, description: '일' },
  { name: 'relationship', type: T, description: '관계' },
  { name: 'prevention', type: P, description: '예방' },
  { name: 'intervention', type: P, description: '조기개입' },
  { name: 'treatment', type: P, description: '치료' },
  { name: 'rehabilitation', type: P, description: '재활' },
  { name: 'regulation', type: P, description: '규제' },
  { name: 'funding', type: P, description: '재정' },
];

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(Tag);

  await repo
    .createQueryBuilder()
    .insert()
    .into(Tag)
    .values(TAGS)
    .orIgnore() // 이미 있는 name은 건너뜀(멱등)
    .execute();

  const total = await repo.count();
  console.log(`[seed:tags] 시드 ${TAGS.length}건 적용, 테이블 총 ${total}건`);

  await ds.destroy();
}

run().catch((e) => {
  console.error('[seed:tags] 실패:', e);
  process.exit(1);
});
