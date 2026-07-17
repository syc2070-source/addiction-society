import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Source } from './entities/source.entity';
import { SourcesNotifier } from './discord.notifier';

const UA = 'AddictionSociety-Observatory/1.0 (+https://addictionsociety.net)';
const TIMEOUT_MS = 30_000;
const GAP_MS = 2000; // 요청 간 최소 2초
const MAX_FAIL = 3; // 최대값: 연속 실패 3회면 stale

/** 소스 1건 처리 결과 */
export interface MonitorResult {
  id: string;
  status: 'changed' | 'unchanged' | 'manual' | 'blocked' | 'error' | 'stale';
  method?: string;
  detail?: string;
  failCount?: number;
}

/**
 * 발표 감시 스케줄러.
 * ScheduleModule.forRoot()는 SchedulerModule에서 이미 1회 등록돼 있으므로
 * 여기서는 provider로만 등록한다(@Cron은 전역 explorer가 자동 발견).
 *
 * 설계 원칙:
 *  - 크론 최상위 try/catch + 소스별 try/catch 이중 격리. 하나 죽어도 전체 생존.
 *  - "발표 감시"까지만. 데이터 수집은 M3.
 */
@Injectable()
export class SourcesScheduler {
  private readonly logger = new Logger(SourcesScheduler.name);

  constructor(
    @InjectRepository(Source)
    private readonly repo: Repository<Source>,
    private readonly notifier: SourcesNotifier,
  ) {}

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private summarize(res: MonitorResult[]): string {
    const c: Record<string, number> = {};
    for (const r of res) c[r.status] = (c[r.status] || 0) + 1;
    return JSON.stringify(c);
  }

  /** 매일 09:00 KST — 발표 임박(오늘+30일 이내) 소스 감시 */
  @Cron('0 9 * * *', {
    name: 'sourcesDailyMonitor',
    timeZone: 'Asia/Seoul',
  })
  async handleDailyMonitor(): Promise<void> {
    try {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const hz = horizon.toISOString().slice(0, 10);
      const due = await this.repo
        .createQueryBuilder('s')
        .where("s.status = 'active'")
        .andWhere('s.nextExpectedAt IS NOT NULL')
        .andWhere('s.nextExpectedAt <= :hz', { hz })
        .getMany();
      this.logger.log(`[cron:daily] 대상 ${due.length}건 (next_expected_at <= ${hz})`);
      const res = await this.monitorSources(due);
      this.logger.log(`[cron:daily] 완료 ${this.summarize(res)}`);
    } catch (e: any) {
      // 최상위 격리: 절대 throw 하지 않음
      this.logger.error(`[cron:daily] 최상위 예외(무시): ${e?.message || e}`);
    }
  }

  /** 매주 월요일 09:00 KST — next_expected_at이 null인 irregular 소스 감시 */
  @Cron('0 9 * * 1', {
    name: 'sourcesWeeklyIrregular',
    timeZone: 'Asia/Seoul',
  })
  async handleWeeklyIrregular(): Promise<void> {
    try {
      const irr = await this.repo
        .createQueryBuilder('s')
        .where("s.status = 'active'")
        .andWhere("s.cadence = 'irregular'")
        .getMany();
      this.logger.log(`[cron:weekly] irregular 대상 ${irr.length}건`);
      const res = await this.monitorSources(irr);
      this.logger.log(`[cron:weekly] 완료 ${this.summarize(res)}`);
    } catch (e: any) {
      this.logger.error(`[cron:weekly] 최상위 예외(무시): ${e?.message || e}`);
    }
  }

  /**
   * 소스 목록을 순차 감시. 소스별 try/catch로 격리하여 하나가 죽어도 계속 진행.
   * 요청 간 2초 간격.
   */
  async monitorSources(sources: Source[]): Promise<MonitorResult[]> {
    const results: MonitorResult[] = [];
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      try {
        results.push(await this.checkOne(s));
      } catch (e: any) {
        // 이중 격리: checkOne 밖에서 발생한 예기치 못한 예외도 흡수
        this.logger.error(
          `[monitor] ${s.id} 예기치 못한 예외(격리됨): ${e?.message || e}`,
        );
        results.push({
          id: s.id,
          status: 'error',
          detail: String(e?.message || e),
        });
      }
      if (i < sources.length - 1) await this.sleep(GAP_MS);
    }
    return results;
  }

  /** 소스 1건 감시(변경 감지 + DB 갱신 + 알림) */
  private async checkOne(s: Source): Promise<MonitorResult> {
    const now = new Date();

    // manual: HTTP 확인 건너뛰고 알림만
    if (s.accessMethod === 'manual') {
      await this.repo.update(s.id, { lastCheckedAt: now });
      await this.notifier.notify(s, 'manual');
      this.logger.log(`[monitor] MANUAL  ${s.id} — HTTP 생략, 알림만`);
      return { id: s.id, status: 'manual' };
    }

    try {
      const det = await this.detectChange(s);

      // 403/405 차단은 stale 아님 — 확인만 갱신
      if (det.blocked) {
        await this.repo.update(s.id, { lastCheckedAt: now, failCount: 0 });
        this.logger.log(`[monitor] BLOCKED ${s.id} — 403/405, stale 판정 보류`);
        return { id: s.id, status: 'blocked', method: det.method };
      }

      await this.repo.update(s.id, {
        lastCheckedAt: now,
        failCount: 0, // 성공 시 카운터 리셋
        ...det.update,
      });

      if (det.changed) {
        await this.notifier.notify(s, 'change');
        this.logger.log(`[monitor] CHANGED ${s.id} (${det.method})`);
        return { id: s.id, status: 'changed', method: det.method };
      }
      this.logger.log(`[monitor] OK      ${s.id} (${det.method})`);
      return { id: s.id, status: 'unchanged', method: det.method };
    } catch (e: any) {
      // 네트워크/타임아웃/기타 실패 → 연속 실패 카운트
      const failCount = (s.failCount || 0) + 1;
      const willStale = failCount >= MAX_FAIL;
      await this.repo.update(s.id, {
        lastCheckedAt: now,
        failCount,
        status: willStale ? 'stale' : s.status,
      });
      this.logger.warn(
        `[monitor] FAIL    ${s.id} (${e?.message || e}) — 연속 ${failCount}회${willStale ? ' → stale' : ''}`,
      );
      return {
        id: s.id,
        status: willStale ? 'stale' : 'error',
        detail: String(e?.message || e),
        failCount,
      };
    }
  }

  /**
   * 변경 감지 3단 폴백.
   *  1) HEAD → ETag 비교
   *  2) HEAD → Last-Modified 비교
   *  3) GET → 본문 SHA-256 해시 비교
   * HEAD가 403/405면 곧바로 GET으로 폴백하고 stale로 판정하지 않는다.
   * 최초 확인(기존 값 null)은 기준값만 저장하고 '변경'으로 보지 않는다(초기 오탐 방지).
   */
  private async detectChange(
    s: Source,
  ): Promise<{
    changed: boolean;
    method: string;
    update: Partial<Source>;
    blocked?: boolean;
  }> {
    let head: Response | null = null;
    try {
      head = await fetch(s.url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
    } catch {
      head = null; // HEAD 예외 → GET 폴백 시도
    }

    if (head) {
      if (head.status === 403 || head.status === 405) {
        // HEAD 차단 → GET 폴백 (아래로 진행)
      } else if (head.ok) {
        const etag = head.headers.get('etag');
        const lm = head.headers.get('last-modified');
        if (etag) {
          const changed = s.etag != null && s.etag !== etag;
          return { changed, method: 'etag', update: { etag } };
        }
        if (lm) {
          const changed = s.lastModified != null && s.lastModified !== lm;
          return {
            changed,
            method: 'last-modified',
            update: { lastModified: lm },
          };
        }
        // 검증자 없음 → GET 해시로 폴백
      } else {
        throw new Error(`HEAD HTTP ${head.status}`);
      }
    }

    // GET 본문 해시
    const get = await fetch(s.url, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    if (get.status === 403 || get.status === 405) {
      // GET도 차단 → 판정 불가, stale 아님
      return { changed: false, method: 'blocked', update: {}, blocked: true };
    }
    if (!get.ok) throw new Error(`GET HTTP ${get.status}`);
    const body = await get.text();
    const hash = createHash('sha256').update(body).digest('hex');
    const changed = s.contentHash != null && s.contentHash !== hash;
    return { changed, method: 'hash', update: { contentHash: hash } };
  }
}
