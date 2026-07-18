import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import { User } from './auth/entities/user.entity';
import { Research } from './research/entities/research.entity';
import { Document } from './policy/entities/document.entity';
import { AssessmentCell } from './policy/entities/assessment-cell.entity';
import { RecoveryResource } from './recovery/entities/recovery-resource.entity';
import { Tag } from './tags/entities/tag.entity';
import { Source } from './sources/entities/source.entity';

// CLI는 Nest 컨텍스트 밖에서 돌아가므로 .env를 직접 로드한다(app.module과 동일한 env 키).
config();

/**
 * TypeORM CLI(마이그레이션) 전용 DataSource.
 * 시드/유틸 스크립트도 이 DataSource를 재사용해 스키마 정의를 한 곳으로 유지한다.
 *
 * ⚠️ 엔티티 추가 시 app.module.ts에도 반드시 등록할 것 (역방향 동일).
 *    스키마 변경은 오직 마이그레이션으로만 한다(synchronize:false).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'addiction_society',
  // Supabase 등 원격 DB는 SSL 필요. 로컬은 DB_SSL 미설정(false)이라 영향 없음.
  ssl:
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // app.module.ts의 entities 배열과 반드시 일치해야 한다(7개).
  entities: [
    User,
    Research,
    Document,
    AssessmentCell,
    RecoveryResource,
    Tag,
    Source,
  ],
  // CLI는 ts-node로 실행되므로 소스(.ts) 경로만 지정.
  // (dist/*.js를 함께 넣으면 watch 컴파일 산출물과 중복 로드되어 오류)
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
