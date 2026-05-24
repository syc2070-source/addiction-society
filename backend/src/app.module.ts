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

import { User } from './auth/entities/user.entity';
import { Research } from './research/entities/research.entity';
import { Document } from './policy/entities/document.entity';
import { AssessmentCell } from './policy/entities/assessment-cell.entity';
import { RecoveryResource } from './recovery/entities/recovery-resource.entity';
import { Tag } from './tags/entities/tag.entity';

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
        entities: [
          User,
          Research,
          Document,
          AssessmentCell,
          RecoveryResource,
          Tag,
        ],
        synchronize: true,
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
  ],
})
export class AppModule {}