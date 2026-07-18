import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ResearchModule } from './research/research.module';
import { PolicyModule } from './policy/policy.module';
import { RecoveryModule } from './recovery/recovery.module';
import { TagsModule } from './tags/tags.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ReportsModule } from './reports/reports.module';
import { SourcesModule } from './sources/sources.module';

import { User } from './auth/entities/user.entity';
import { Research } from './research/entities/research.entity';
import { Document } from './policy/entities/document.entity';
import { AssessmentCell } from './policy/entities/assessment-cell.entity';
import { RecoveryResource } from './recovery/entities/recovery-resource.entity';
import { Tag } from './tags/entities/tag.entity';
import { Source } from './sources/entities/source.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USER', 'postgres'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_NAME', 'addiction_society'),
        // 엔티티 추가 시 data-source.ts에도 등록할 것 (역방향 동일)
        entities: [
          User,
          Research,
          Document,
          AssessmentCell,
          RecoveryResource,
          Tag,
          Source,
        ],
        // 스키마 변경은 오직 마이그레이션으로만. DB_SYNCHRONIZE='true'를 명시한
        // 경우에만 켜짐(기본 false). 운영에서는 절대 금지(테이블 파괴 위험).
        synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
        // 마이그레이션은 배포 스크립트에서 수동 실행(npm run migration:run)한다.
        migrationsRun: false,
        logging: true,
      }),
      inject: [ConfigService],
    }),

    ResearchModule,
    PolicyModule,
    RecoveryModule,
    TagsModule,
    AuthModule,
    UploadModule,
    SchedulerModule,
    ReportsModule,
    SourcesModule,
  ],
})
export class AppModule {}