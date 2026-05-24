import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ResearchAutoService } from '../research/research-auto.service';
import { PolicyAutoService } from '../policy/policy-auto.service';

@Injectable()
export class AutoCollectScheduler {
  private readonly logger = new Logger(AutoCollectScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly researchAuto: ResearchAutoService,
    private readonly policyAuto: PolicyAutoService,
  ) {}

  /** 기본: 매일 새벽 3시(KST). .env 의 AUTO_COLLECT_CRON 으로 재정의 가능 */
  @Cron(process.env.AUTO_COLLECT_CRON || '0 3 * * *', {
    name: 'autoCollectResearchPolicy',
    timeZone: process.env.AUTO_COLLECT_TZ || 'Asia/Seoul',
  })
  async handleScheduledCollect(): Promise<void> {
    if (this.config.get<string>('AUTO_COLLECT_ENABLED') === 'false') {
      return;
    }
    try {
      const r = await this.researchAuto.runOnce();
      const p = await this.policyAuto.runOnce();
      this.logger.log(
        `스케줄 자동수집 완료 — 연구: +${r.inserted} / 건너뜀 ${r.skipped}, 정책: +${p.inserted} / 건너뜀 ${p.skipped}`,
      );
    } catch (e) {
      this.logger.error('스케줄 자동수집 실패', e);
    }
  }
}
