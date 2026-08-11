import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { load } from 'cheerio';
import { Agent, fetch as undiciFetch } from 'undici';
import { Source } from './entities/source.entity';
import { SourcesNotifier } from './discord.notifier';
import { SourceEventsService } from './source-events.service';
import { computeNextExpected, monthStartOf } from './next-expected.util';

const UA = 'AddictionSociety-Observatory/1.0 (+https://addictionsociety.net)';
const TIMEOUT_MS = 30_000;
const GAP_MS = 2000; // 요청 간 최소 2초
const MAX_FAIL = 3; // 최대값: 연속 실패 3회면 stale

// 알림 쿨다운: 같은 소스가 이 기간 안에 또 트리거되면 알림 생략(로그만)
const COOLDOWN_CHANGE_MS = 7 * 24 * 3600_000; // 갱신 감지 7일
const COOLDOWN_MANUAL_MS = 30 * 24 * 3600_000; // 수동 확인 요망 30일

// TLS 중간 인증서를 서버가 제공하지 않는 소스 전용(검증 생략).
// accessDetail.tls === 'insecure'인 소스에만 사용한다.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

/** 페이지 응답의 공통 최소 형태(global fetch / undici fetch 겸용) */
interface PageResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** 게시판 최신글 감지용 셀렉터 (accessDetail.board) */
interface BoardSelectors {
  row: string;
  title: string;
  date: string;
}

/**
 * GET 본문 해시 전 정규화 — 동적 페이지 오탐 방지.
 * 실측(spo.go.kr·drugfree.or.kr 2회 fetch diff, 2026-07) 기반:
 *  - 연속 요청 간 차이는 없었고, csrf/세션 토큰도 발견되지 않았다.
 *  - 일 단위 가변 요소는 게시물 조회수 등 본문 콘텐츠 자체(게시판형은
 *    board-latest 감지로 해결). 여기서는 스크립트/스타일/주석/hidden input/
 *    jsessionid류 URL 파라미터 등 콘텐츠가 아닌 가변 후보를 제거한다.
 */
export function normalizeForHash(body: string): string {
  return body
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<input\b[^>]*type=["']?hidden["']?[^>]*>/gi, ' ')
    .replace(/;?jsessionid=[^"'&\s>]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 게시판 날짜 문자열('2026.07.21.' / '2026-03-09' 등) → 'YYYY-MM-DD' */
export function parseBoardDate(raw: string): string | null {
  const m = raw.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** 소스 1건 처리 결과 */
export interface MonitorResult {
  id: string;
  status: 'changed' | 'unchanged' | 'manual' | 'blocked' | 'error' | 'stale';
  method?: string;
  detail?: string;
  failCount?: number;
}

/** 예정일 이월 1건 결과 */
export interface ReconcileResult {
  id: string;
  from: string | null;
  to: string | null;
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
    private readonly events: SourceEventsService,
  ) {}

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** 변경 감지 방법에 맞는 (이전, 이후) 검증자 값을 뽑는다(이벤트 기록용). */
  private hashPair(
    s: Source,
    det: { method: string; update: Partial<Source> },
  ): { prevHash: string | null; newHash: string | null } {
    const u = det.update;
    if (u.contentHash !== undefined) {
      return {
        prevHash: s.contentHash ?? null,
        newHash: u.contentHash ?? null,
      };
    }
    if (u.etag !== undefined) {
      return { prevHash: s.etag ?? null, newHash: u.etag ?? null };
    }
    if (u.lastModified !== undefined) {
      return {
        prevHash: s.lastModified ?? null,
        newHash: u.lastModified ?? null,
      };
    }
    return { prevHash: null, newHash: null };
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
      this.logger.log(
        `[cron:daily] 대상 ${due.length}건 (next_expected_at <= ${hz})`,
      );
      const res = await this.monitorSources(due);
      this.logger.log(`[cron:daily] 완료 ${this.summarize(res)}`);

      // 감시 후에 이월한다. 순서가 중요: 예정일이 지난 소스야말로 지금 확인해야 할
      // 대상이므로 먼저 감시하고(발간을 잡으면 그 자리에서 재계산됨),
      // 그래도 발간을 못 잡은 것만 다음 주기로 넘긴다.
      const rolled = await this.reconcileExpected();
      this.logger.log(`[cron:daily] 예정일 이월 ${rolled.length}건`);
    } catch (e: any) {
      // 최상위 격리: 절대 throw 하지 않음
      this.logger.error(`[cron:daily] 최상위 예외(무시): ${e?.message || e}`);
    }
  }

  /**
   * 매주 월요일 09:00 KST — 발표 예정일을 모르는 소스 감시.
   *
   * AS-FIX-1(감사 문제 #3): 이전 조건은 `cadence='irregular'`뿐이었다.
   * 그런데 expected_month가 없어 next_expected_at이 null인데 cadence는
   * irregular이 아닌 소스가 4건 있었다(kcgp_rehab·ncmh_mhs·ngcc_gambling·
   * samhsa_nsumhss). 이들은 일일 크론의 `nextExpectedAt IS NOT NULL` 조건에서도
   * 탈락해 **어떤 크론에도 잡히지 않았다** — 레지스트리의 17%가 감시 사각지대.
   *
   * 조건을 "예정일을 모르는 소스 전부"로 넓혀 사각지대를 없앤다.
   * 발표 월을 임의로 지어내 채우는 방식은 쓰지 않는다(추측 데이터 금지) —
   * 모른다는 사실을 그대로 두고 감시 규칙으로 흡수하는 편이 정직하다.
   */
  @Cron('0 9 * * 1', {
    name: 'sourcesWeeklyIrregular',
    timeZone: 'Asia/Seoul',
  })
  async handleWeeklyIrregular(): Promise<void> {
    try {
      const irr = await this.repo
        .createQueryBuilder('s')
        .where("s.status = 'active'")
        .andWhere("(s.cadence = 'irregular' OR s.nextExpectedAt IS NULL)")
        .getMany();
      this.logger.log(`[cron:weekly] 예정일 미상 대상 ${irr.length}건`);
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

  /**
   * 지난 예정일 이월 (AS-M3-FIX-DATE).
   *
   * next_expected_at은 시딩 직후 1회 백필될 뿐 스스로 늙지 않았다. 예정 월이
   * 지나도 그 값이 남아 홈 카드의 "다음 발표 예정"에 과거 날짜가 노출됐다.
   * 여기서 매일 재계산해 다음 주기로 넘긴다.
   *
   * 대상은 status를 가리지 않는다. stale/paused 소스도 목록·달력에 나오므로
   * 화면에 과거가 남지 않으려면 데이터 자체가 최신이어야 한다.
   *
   * 이월은 "예정 월이 지났는데 발간을 잡지 못했다"는 감시 정보이므로
   * source_events에 rescheduled로 남긴다(원칙 11 — 예정일이 언제 어떻게
   * 바뀌었는지도 이력이다).
   */
  async reconcileExpected(
    today: Date = new Date(),
  ): Promise<ReconcileResult[]> {
    const cutoff = monthStartOf(today);
    const overdue = await this.repo
      .createQueryBuilder('s')
      .where('s.nextExpectedAt IS NOT NULL')
      .andWhere('s.nextExpectedAt < :cutoff', { cutoff })
      .getMany();

    const rolled: ReconcileResult[] = [];
    for (const s of overdue) {
      try {
        const from = s.nextExpectedAt ?? null;
        const to = computeNextExpected(s, today);
        // 재계산해도 그대로면(이론상 없음) 이벤트 소음을 만들지 않는다.
        if (to === from) continue;
        await this.repo.update(s.id, { nextExpectedAt: to });
        await this.events.record({
          sourceId: s.id,
          eventType: 'rescheduled',
          detail: {
            from,
            to,
            reason: 'overdue',
            // 예정 월이 지나도록 발간을 확인하지 못했다는 사실을 남긴다.
            publicationConfirmed: false,
          },
          notified: false,
        });
        this.logger.log(
          `[reconcile] ${s.id} 예정일 이월 ${from} → ${to ?? '미정'} (발간 미확인)`,
        );
        rolled.push({ id: s.id, from, to });
      } catch (e: any) {
        // 소스별 격리 — 한 건이 죽어도 나머지는 계속
        this.logger.error(
          `[reconcile] ${s.id} 실패(격리됨): ${e?.message || e}`,
        );
      }
    }
    return rolled;
  }

  /** 마지막 알림 후 cooldownMs가 아직 지나지 않았으면 true */
  private inCooldown(s: Source, cooldownMs: number, now: Date): boolean {
    return (
      s.lastNotifiedAt != null &&
      now.getTime() - new Date(s.lastNotifiedAt).getTime() < cooldownMs
    );
  }

  /** 소스 1건 감시(변경 감지 + DB 갱신 + 알림) */
  private async checkOne(s: Source): Promise<MonitorResult> {
    const now = new Date();

    // manual: HTTP 확인 건너뛰고 알림만 (30일 쿨다운)
    if (s.accessMethod === 'manual') {
      if (this.inCooldown(s, COOLDOWN_MANUAL_MS, now)) {
        await this.repo.update(s.id, { lastCheckedAt: now });
        await this.events.record({
          sourceId: s.id,
          eventType: 'manual',
          detail: { cooldown: true },
          notified: false,
        });
        this.logger.log(
          `[monitor] MANUAL  ${s.id} — 쿨다운 30일 내(마지막 알림 ${new Date(s.lastNotifiedAt!).toISOString()}), 알림 생략`,
        );
        return { id: s.id, status: 'manual', detail: 'cooldown' };
      }
      await this.repo.update(s.id, { lastCheckedAt: now, lastNotifiedAt: now });
      await this.notifier.notify(s, 'manual');
      await this.events.record({
        sourceId: s.id,
        eventType: 'manual',
        notified: true,
      });
      this.logger.log(`[monitor] MANUAL  ${s.id} — HTTP 생략, 알림만`);
      return { id: s.id, status: 'manual' };
    }

    try {
      const det = await this.detectChange(s);

      // 403/405 차단은 stale 아님 — 확인만 갱신
      if (det.blocked) {
        await this.repo.update(s.id, { lastCheckedAt: now, failCount: 0 });
        await this.events.record({
          sourceId: s.id,
          eventType: 'blocked',
          detail: { method: det.method },
          notified: false,
        });
        this.logger.log(`[monitor] BLOCKED ${s.id} — 403/405, stale 판정 보류`);
        return { id: s.id, status: 'blocked', method: det.method };
      }

      // 발간을 새로 잡았으면 그 자리에서 예정일을 재계산한다.
      // 감지 방식(게시판·해시·ETag)과 무관하게 한 곳에서 처리해,
      // 새 감지기를 추가해도 예정일이 늙지 않게 한다.
      const update: Partial<Source> = { ...det.update };
      if (update.lastPublishedAt) {
        update.nextExpectedAt = computeNextExpected(
          {
            cadence: s.cadence,
            expectedMonth: s.expectedMonth,
            lastPublishedAt: update.lastPublishedAt,
          },
          now,
        );
      }

      await this.repo.update(s.id, {
        lastCheckedAt: now,
        failCount: 0, // 성공 시 카운터 리셋
        ...update,
      });

      if (det.changed) {
        const { prevHash, newHash } = this.hashPair(s, det);
        const newPub = update.lastPublishedAt ?? null;
        // 발간일이 새로 잡히면 '발간(published)', 아니면 '변경(changed)'
        const eventType = newPub ? 'published' : 'changed';
        const cooldown = this.inCooldown(s, COOLDOWN_CHANGE_MS, now);
        // 갱신 감지 7일 쿨다운: 변경 기록(det.update)은 반영하되 알림만 생략
        if (!cooldown) {
          await this.repo.update(s.id, { lastNotifiedAt: now });
          await this.notifier.notify(s, 'change');
        }
        await this.events.record({
          sourceId: s.id,
          eventType,
          prevHash,
          newHash,
          prevPublishedAt: s.lastPublishedAt ?? null,
          newPublishedAt: newPub,
          detail: {
            method: det.method,
            // 발간 감지로 예정일이 바뀌었으면 그 변화도 이력에 남긴다(원칙 11)
            ...(newPub
              ? {
                  prevExpectedAt: s.nextExpectedAt ?? null,
                  newExpectedAt: update.nextExpectedAt ?? null,
                }
              : {}),
            ...(cooldown ? { cooldown: true } : {}),
          },
          notified: !cooldown,
        });
        this.logger.log(
          `[monitor] CHANGED ${s.id} (${det.method})${cooldown ? ' — 쿨다운 7일 내, 알림 생략' : ''}`,
        );
        return {
          id: s.id,
          status: 'changed',
          method: det.method,
          ...(cooldown ? { detail: 'cooldown' } : {}),
        };
      }
      await this.events.record({
        sourceId: s.id,
        eventType: 'checked',
        detail: { method: det.method },
        notified: false,
      });
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
      await this.events.record({
        sourceId: s.id,
        eventType: willStale ? 'stale' : 'failed',
        detail: { message: String(e?.message || e), failCount },
        notified: false,
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
   * HTTP 요청 헬퍼. accessDetail.tls === 'insecure'인 소스(서버가 중간 인증서를
   * 안 주는 drugfree.or.kr 등)만 검증 생략 Agent로 요청한다.
   */
  private fetchPage(s: Source, method: 'HEAD' | 'GET'): Promise<PageResponse> {
    const init = {
      method,
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow' as const,
    };
    if (s.accessDetail?.tls === 'insecure') {
      return undiciFetch(s.url, { ...init, dispatcher: insecureAgent });
    }
    return fetch(s.url, init);
  }

  /**
   * 게시판형 소스: 전체 페이지 해시 대신 "목록 첫 행(제목+날짜)"으로 변경 감지.
   * 조회수·새글 배지 등 목록 페이지의 일상적 가변 요소에 흔들리지 않는다.
   * 새 게시물 감지 시 lastPublishedAt을 게시물 날짜로 갱신한다(감지 → 기록 연결).
   */
  private async detectBoardLatest(
    s: Source,
    sel: BoardSelectors,
  ): Promise<{
    changed: boolean;
    method: string;
    update: Partial<Source>;
    blocked?: boolean;
  }> {
    const get = await this.fetchPage(s, 'GET');
    if (get.status === 403 || get.status === 405) {
      return { changed: false, method: 'blocked', update: {}, blocked: true };
    }
    if (!get.ok) throw new Error(`GET HTTP ${get.status}`);

    const $ = load(await get.text());
    const row = $(sel.row).first();
    const title = row
      .find(sel.title)
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const dateRaw = row.find(sel.date).first().text().trim();
    if (!title) {
      // 셀렉터가 빗나감(사이트 개편 등) → 실패로 취급해 failCount 경로로
      throw new Error(`게시판 첫 행 파싱 실패 (row='${sel.row}')`);
    }
    const latestDate = parseBoardDate(dateRaw);
    const hash = createHash('sha256')
      .update(`${title}|${latestDate ?? dateRaw}`)
      .digest('hex');
    const changed = s.contentHash != null && s.contentHash !== hash;

    const update: Partial<Source> = { contentHash: hash };
    // 최초 기준값 저장 시에도 실측 날짜를 기록(정확한 발간 이력 확보).
    // nextExpectedAt 재계산은 checkOne이 일괄 처리한다(감지 방식과 무관하게).
    if ((changed || s.contentHash == null) && latestDate) {
      update.lastPublishedAt = latestDate;
    }
    this.logger.log(
      `[monitor] 게시판 최신글 ${s.id}: "${title}" (${latestDate ?? (dateRaw || '날짜 없음')})`,
    );
    return { changed, method: 'board-latest', update };
  }

  /**
   * 변경 감지.
   *  0) accessDetail.board 셀렉터가 있으면 → 게시판 최신글(제목+날짜) 감지
   *  1) HEAD → ETag 비교
   *  2) HEAD → Last-Modified 비교
   *  3) GET → 정규화(스크립트/주석/hidden input 제거 등) 본문 SHA-256 해시 비교
   * HEAD가 403/405면 곧바로 GET으로 폴백하고 stale로 판정하지 않는다.
   * 최초 확인(기존 값 null)은 기준값만 저장하고 '변경'으로 보지 않는다(초기 오탐 방지).
   */
  private async detectChange(s: Source): Promise<{
    changed: boolean;
    method: string;
    update: Partial<Source>;
    blocked?: boolean;
  }> {
    const board = s.accessDetail?.board as BoardSelectors | undefined;
    if (board?.row && board?.title && board?.date) {
      return this.detectBoardLatest(s, board);
    }

    let head: PageResponse | null = null;
    try {
      head = await this.fetchPage(s, 'HEAD');
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

    // GET 본문 해시 (정규화 후)
    const get = await this.fetchPage(s, 'GET');
    if (get.status === 403 || get.status === 405) {
      // GET도 차단 → 판정 불가, stale 아님
      return { changed: false, method: 'blocked', update: {}, blocked: true };
    }
    if (!get.ok) throw new Error(`GET HTTP ${get.status}`);
    const body = normalizeForHash(await get.text());
    const hash = createHash('sha256').update(body).digest('hex');
    const changed = s.contentHash != null && s.contentHash !== hash;
    return { changed, method: 'hash', update: { contentHash: hash } };
  }
}
