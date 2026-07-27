import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Source } from './entities/source.entity';
import { CADENCE_KO } from './next-expected.util';

/** 알림 발생 사유 */
export type NotifyReason = 'change' | 'manual' | 'due';

const REASON_HEADER: Record<NotifyReason, string> = {
  change: '📢 소스 갱신 감지',
  manual: '📢 소스 발표 임박 (수동 확인 요망)',
  due: '📢 소스 발표 임박',
};

/**
 * 데이터 관측소 Discord 알림.
 * 환경변수 DISCORD_WEBHOOK_OBSERVATORY 가 없으면 실제 전송 없이 로그만 남긴다
 * (크론은 계속 동작). 전송 실패해도 절대 throw 하지 않는다.
 */
@Injectable()
export class SourcesNotifier {
  private readonly logger = new Logger(SourcesNotifier.name);

  constructor(private readonly config: ConfigService) {}

  /** 메시지 본문 구성 (중요 소스는 ⚠️ 강조) */
  buildMessage(source: Source, reason: NotifyReason): string {
    // 중요 소스: 1차 소스 AND 한국 → 기사화 우선순위
    const emphasis =
      source.reliability === 1 && source.scope === 'korea' ? '⚠️ ' : '';
    const cadenceKo = CADENCE_KO[source.cadence] || source.cadence;
    const lines = [
      `${emphasis}${REASON_HEADER[reason]}`,
      `기관: ${source.orgKo}`,
      `자료: ${source.titleKo}`,
      `주기: ${cadenceKo} (마지막 ${source.lastPublishedAt || '수집 중'})`,
      `링크: ${source.url}`,
    ];
    if (source.notes) lines.push(source.notes);
    return lines.join('\n');
  }

  /** 알림 전송. 웹훅 미설정 시 로그만. 실패해도 throw 하지 않음. */
  async notify(source: Source, reason: NotifyReason): Promise<void> {
    await this.notifyText(this.buildMessage(source, reason), source.id);
  }

  /** 임의 텍스트 알림(지표 추출 등 소스 외 용도). 웹훅 없으면 로그만, 실패해도 throw 안 함. */
  async notifyText(content: string, tag = 'observatory'): Promise<void> {
    const webhook = this.config
      .get<string>('DISCORD_WEBHOOK_OBSERVATORY')
      ?.trim();

    if (!webhook) {
      // 웹훅 없음 → 전송 생략, 내용만 로그(무엇을 보낼지 확인 가능)
      this.logger.log(`[알림 생략: 웹훅 미설정] (${tag})\n${content}`);
      return;
    }

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        this.logger.warn(`Discord 전송 실패 HTTP ${res.status} — ${tag}`);
      } else {
        this.logger.log(`Discord 전송 완료 — ${tag}`);
      }
    } catch (e: any) {
      this.logger.warn(`Discord 전송 예외 — ${tag}: ${e?.message || e}`);
    }
  }
}
