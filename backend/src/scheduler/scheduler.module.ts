import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SourcesModule } from '../sources/sources.module';
import { DailyJobsScheduler } from './daily-jobs.scheduler';

/**
 * 크론 인프라 등록 전용 모듈.
 * ScheduleModule.forRoot()를 한 곳에서 등록한다 — 발표감시 크론은 SourcesScheduler
 * (P1 발표감시)가 @Cron으로 정의하며 이 forRoot에 의존한다.
 *
 * AUTO_COLLECT 스케줄러(연구·정책 데모 자동수집)는 M3-1에서 폐기됨
 * (데모/플레이스홀더 삽입이라 원칙1 위반).
 *
 * SOC-R1: DailyJobsScheduler — 배포 때 돌던 seed·collect·backfill 을 매일 04:00 KST
 * 한 번으로 옮겼다(배포 = migration + 멱등 seed 만). 실패 알림은 SourcesNotifier.
 */
@Module({
  imports: [ScheduleModule.forRoot(), SourcesModule],
  providers: [DailyJobsScheduler],
})
export class SchedulerModule {}
