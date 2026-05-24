import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ResearchModule } from '../research/research.module';
import { PolicyModule } from '../policy/policy.module';
import { AutoCollectScheduler } from './auto-collect.scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ResearchModule,
    PolicyModule,
  ],
  providers: [AutoCollectScheduler],
})
export class SchedulerModule {}
