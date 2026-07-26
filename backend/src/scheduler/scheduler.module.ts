import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * 크론 인프라 등록 전용 모듈.
 * ScheduleModule.forRoot()를 한 곳에서 등록한다 — 실제 크론 잡은 SourcesScheduler
 * (P1 발표감시)가 @Cron으로 정의하며 이 forRoot에 의존한다.
 *
 * AUTO_COLLECT 스케줄러(연구·정책 데모 자동수집)는 M3-1에서 폐기됨
 * (데모/플레이스홀더 삽입이라 원칙1 위반). 지표 수집은 collect:indicators 수동 스크립트로.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
})
export class SchedulerModule {}
