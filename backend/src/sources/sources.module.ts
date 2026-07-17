import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Source } from './entities/source.entity';
import { SourcesService } from './sources.service';
import { SourcesController } from './sources.controller';
import { SourcesScheduler } from './sources.scheduler';
import { SourcesNotifier } from './discord.notifier';

// ScheduleModule.forRoot()는 SchedulerModule에서 이미 등록됨 → 여기서 재등록하지 않는다.
@Module({
  imports: [TypeOrmModule.forFeature([Source])],
  controllers: [SourcesController],
  providers: [SourcesService, SourcesScheduler, SourcesNotifier],
  exports: [SourcesService],
})
export class SourcesModule {}
