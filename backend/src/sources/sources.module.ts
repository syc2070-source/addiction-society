import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Source } from './entities/source.entity';
import { SourceEvent } from './entities/source-event.entity';
import { SourcesService } from './sources.service';
import { SourcesController } from './sources.controller';
import { TimelineController } from './timeline.controller';
import { SourcesScheduler } from './sources.scheduler';
import { SourcesNotifier } from './discord.notifier';
import { SourceEventsService } from './source-events.service';

// ScheduleModule.forRoot()는 SchedulerModule에서 이미 등록됨 → 여기서 재등록하지 않는다.
@Module({
  imports: [TypeOrmModule.forFeature([Source, SourceEvent])],
  controllers: [SourcesController, TimelineController],
  providers: [
    SourcesService,
    SourcesScheduler,
    SourcesNotifier,
    SourceEventsService,
  ],
  exports: [SourcesService, SourceEventsService, SourcesNotifier],
})
export class SourcesModule {}
