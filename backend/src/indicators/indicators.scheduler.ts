import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { IndicatorPdfService } from './indicator-pdf.service';

/**
 * 지표 PDF 자동추출 크론 (AS-M3-2b) — 셸 수동 실행 제거.
 *
 * 매월 1일 04:00 KST에 kcgp 최신 회차 PDF를 추출해 observations(pending)로 적재한다.
 * kcgp는 격년/연간 발간이라 월 1회면 새 회차를 한 달 내 포착하기 충분하고, URL이 그대로면
 * 멱등(이미 approved면 보호, pending이면 갱신)이라 재실행이 안전하다.
 *
 * 기본 비활성: INDICATOR_PDF_CRON_ENABLED='true'일 때만 동작한다. 운영에서 Render의
 * Python 런타임·gov egress를 실측 확인한 뒤 켠다. 크론은 절대 throw 하지 않는다(격리).
 */
@Injectable()
export class IndicatorsScheduler {
  private readonly logger = new Logger(IndicatorsScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly pdf: IndicatorPdfService,
  ) {}

  @Cron('0 4 1 * *', { name: 'indicatorKcgpPdf', timeZone: 'Asia/Seoul' })
  async handleMonthly(): Promise<void> {
    if (this.config.get<string>('INDICATOR_PDF_CRON_ENABLED') !== 'true') {
      return; // 기본 비활성
    }
    try {
      const r = await this.pdf.extractKcgpYouth();
      this.logger.log(`[cron:pdf] kcgp 추출 ${JSON.stringify(r)}`);
    } catch (e: unknown) {
      // extractKcgpYouth는 throw 안 하지만 이중 격리.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[cron:pdf] 최상위 예외(무시): ${msg}`);
    }
  }
}
