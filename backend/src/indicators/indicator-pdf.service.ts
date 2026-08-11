import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { Indicator } from './entities/indicator.entity';
import { Observation } from './entities/observation.entity';
import { Source } from '../sources/entities/source.entity';
import { SourceEventsService } from '../sources/source-events.service';
import { SourcesNotifier } from '../sources/discord.notifier';
import { IndicatorsService } from './indicators.service';
import { issueReviewToken, newBatchId } from './review-token.util';
import { reviewSecret } from './review-secret.util';

/** Discord 본문에 그대로 싣는 값 줄 수 상한(메시지 2000자 제한 대비) */
const MAX_NOTIFY_ROWS = 25;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * PDF 추출 대상 소스의 힌트 (sources.access_detail에 저장, AS-M3-2d).
 *
 *   {
 *     "pdf": true,                       // 추출 대상 표시(필수)
 *     "parser_adapter": "kcgp_youth",    // tools/pdf-extract/adapters 의 어댑터 id
 *     "pdf_url": "https://.../report.pdf",        // 직접 URL을 알면 최우선
 *     "pdf_finder": { "type": "datagokr_filedata", // 없으면 탐색기로 도출
 *                     "datasetUrl": "https://www.data.go.kr/data/15142248/fileData.do" },
 *     "period": "2024"                   // 관측치 기간(연도). 없으면 올해로 추정하지 않고 skip
 *   }
 *
 * env가 아니라 DB에 두는 이유: 소스·회차가 늘어도 env가 증식하지 않고, 새 소스 추가가
 * `sources` 등록만으로 끝난다(자동화 원칙). 회차 갱신도 access_detail 한 줄 수정.
 */
export interface PdfFinder {
  type: string;
  /** datagokr_filedata: 파일데이터 상세 페이지 */
  datasetUrl?: string;
  /** kcgp_board: 게시판 목록 URL */
  listUrl?: string;
  /** kcgp_board: 제목에서 회차를 고르는 힌트(보통 연도 4자리) */
  titleContains?: string;
}

/** 회차 1건 (AS-PDF-RUN). period + 그 회차의 PDF 위치. */
export interface PdfRound {
  period: string | number;
  pdf_url?: string | null;
  pdf_finder?: PdfFinder | null;
  /** 이 회차의 조사대상(모집단). observations.note로 내려가 추이 오독을 막는다. */
  population?: string | null;
}

export interface PdfSourceHint {
  pdf?: boolean;
  parser_adapter?: string;
  pdf_url?: string | null;
  pdf_finder?: PdfFinder | null;
  period?: string | number | null;
  population?: string | null;
  /** 회차 목록. 있으면 이쪽이 우선(AS-PDF-RUN). 없으면 단일 회차로 동작(하위호환). */
  pdf_rounds?: PdfRound[] | null;
}

interface ExtractedObs {
  geo: string;
  period: string | number;
  value: string | number;
  qualifier?: string | null;
  valueLow?: string | null;
  valueHigh?: string | null;
  sourceUrl?: string;
  /** 어댑터가 판단한 단서(조사대상 등). 회차 설정의 population이 있으면 그쪽 우선. */
  note?: string | null;
}
interface ExtractedIndicator {
  code: string;
  domain: string;
  nameKo: string;
  nameEn?: string | null;
  unit?: string | null;
  definitionKo: string;
  methodNote?: string | null;
  sourceId?: string | null;
  observations: ExtractedObs[];
}
interface ExtractedPayload {
  sourceId: string;
  sourceUrl: string;
  indicators: ExtractedIndicator[];
}

/** 소스 1건 추출 결과 */
export interface SourceExtractionResult {
  sourceId: string;
  /** 회차(연도). AS-PDF-RUN: 소스당 여러 회차를 각각 결과로 낸다. */
  period?: string;
  ran: boolean;
  reason?: string;
  pdfUrl?: string;
  indicators: number;
  pendingInserted: number;
  pendingUpdated: number;
  skippedApproved: number;
  /** 검수 배치 id (pending이 생겼을 때만) */
  batch?: string;
}

export interface FileProbe {
  url: string;
  status: number;
  contentType: string | null;
  bytes: number;
  isPdf: boolean;
  isZip: boolean;
  fileName?: string | null;
  error?: string;
}

/**
 * PDF 추출 → observations(status='pending') 적재 (AS-M3-2b/2d).
 *
 * 대상은 **sources 테이블**에서 온다(access_detail.pdf === true). env에 URL을 두지 않는다.
 * 소스별 표 구조 차이는 Python 어댑터(tools/pdf-extract/adapters/<parser_adapter>.py)가 흡수.
 * 실패는 소스별로 격리하고 source_events(failed)로 남긴다. **절대 throw 하지 않는다**(크론).
 *
 * PDF 표는 기계 오독 위험 → 값은 항상 pending(검수 필수). 정관2조·원칙8.
 */
@Injectable()
export class IndicatorPdfService {
  private readonly logger = new Logger(IndicatorPdfService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Indicator)
    private readonly indicatorRepo: Repository<Indicator>,
    @InjectRepository(Observation)
    private readonly observationRepo: Repository<Observation>,
    @InjectRepository(Source)
    private readonly sourceRepo: Repository<Source>,
    private readonly events: SourceEventsService,
    private readonly notifier: SourcesNotifier,
    // 검수 알림 본문에 실을 값 목록을 뽑기 위해 사용(읽기 전용)
    private readonly indicators: IndicatorsService,
  ) {}

  private get pdfExtractDir(): string {
    return (
      this.config.get<string>('PDF_EXTRACT_DIR')?.trim() ||
      resolve(process.cwd(), '..', 'tools', 'pdf-extract')
    );
  }

  /**
   * 파서를 실행할 python 경로 (AS-M3-2c).
   * PYTHON_BIN(명시) → 빌드가 만든 venv(backend/pdf-venv) → 시스템 python3.
   */
  pythonBin(): string {
    const explicit = this.config.get<string>('PYTHON_BIN')?.trim();
    if (explicit) return explicit;
    const venv =
      this.config.get<string>('PDF_VENV_DIR')?.trim() ||
      resolve(process.cwd(), 'pdf-venv');
    const venvPython = join(venv, 'bin', 'python');
    return existsSync(venvPython) ? venvPython : 'python3';
  }

  /** access_detail에서 PDF 힌트를 꺼낸다. */
  private hintOf(s: Source): PdfSourceHint {
    return (s.accessDetail ?? {}) as PdfSourceHint;
  }

  /** PDF 추출 대상 소스 목록(access_detail.pdf === true). */
  async pdfSources(): Promise<Source[]> {
    const all = await this.sourceRepo.find();
    return all.filter((s) => this.hintOf(s).pdf === true);
  }

  /**
   * 소스의 회차 목록을 확정한다 (AS-PDF-RUN).
   * pdf_rounds가 있으면 그대로, 없으면 기존 단일 period 설정을 1회차로 감싼다(하위호환).
   */
  roundsOf(s: Source): PdfRound[] {
    const hint = this.hintOf(s);
    if (hint.pdf_rounds?.length) return hint.pdf_rounds;
    if (hint.period == null) return [];
    return [
      {
        period: hint.period,
        pdf_url: hint.pdf_url ?? null,
        pdf_finder: hint.pdf_finder ?? null,
        population: hint.population ?? null,
      },
    ];
  }

  /** 대상 소스 전부 순차 추출(소스×회차). 회차별 격리. 크론·수동 트리거 공용. */
  async extractAll(): Promise<SourceExtractionResult[]> {
    const targets = await this.pdfSources();
    this.logger.log(
      `[pdf] 대상 소스 ${targets.length}건 (access_detail.pdf=true)`,
    );
    const results: SourceExtractionResult[] = [];
    for (const s of targets) {
      results.push(...(await this.extractSource(s)));
    }
    return results;
  }

  /** 소스 id로 1건 추출(그 소스의 모든 회차). period 지정 시 그 회차만. */
  async extractOne(
    sourceId: string,
    period?: string,
  ): Promise<SourceExtractionResult[]> {
    const s = await this.sourceRepo.findOne({ where: { id: sourceId } });
    if (!s) {
      return [
        {
          sourceId,
          ran: false,
          reason: 'sources에 없는 id',
          indicators: 0,
          pendingInserted: 0,
          pendingUpdated: 0,
          skippedApproved: 0,
        },
      ];
    }
    return this.extractSource(s, period);
  }

  /**
   * 소스 1건의 회차들을 순차 추출. 절대 throw 안 함.
   * 회차 하나가 실패해도 나머지 회차는 계속 간다(과거 회차는 링크가 잘 깨진다).
   */
  private async extractSource(
    s: Source,
    onlyPeriod?: string,
  ): Promise<SourceExtractionResult[]> {
    const hint = this.hintOf(s);
    const adapter = hint.parser_adapter?.trim();
    const rounds = this.roundsOf(s).filter(
      (r) => !onlyPeriod || String(r.period) === onlyPeriod,
    );

    if (!adapter) {
      return [this.emptyResult(s.id, undefined, 'parser_adapter 미지정')];
    }
    if (rounds.length === 0) {
      return [
        this.emptyResult(
          s.id,
          onlyPeriod,
          onlyPeriod
            ? `회차 ${onlyPeriod} 설정 없음`
            : 'pdf_rounds·period 미지정(회차 없음)',
        ),
      ];
    }

    const out: SourceExtractionResult[] = [];
    for (const round of rounds) {
      out.push(await this.extractRound(s, adapter, round));
    }
    return out;
  }

  private emptyResult(
    sourceId: string,
    period?: string,
    reason?: string,
  ): SourceExtractionResult {
    return {
      sourceId,
      period,
      ran: false,
      reason,
      indicators: 0,
      pendingInserted: 0,
      pendingUpdated: 0,
      skippedApproved: 0,
    };
  }

  /** 회차 1건 추출 본체. 절대 throw 안 함. */
  private async extractRound(
    s: Source,
    adapter: string,
    round: PdfRound,
  ): Promise<SourceExtractionResult> {
    const period = String(round.period ?? '').trim();
    if (!period) return this.emptyResult(s.id, undefined, 'period 없음');
    const base = this.emptyResult(s.id, period);

    let dir: string | null = null;
    try {
      // 1) PDF URL 확정: 직접 URL 우선, 없으면 탐색기(finder)로 도출
      const resolved = await this.resolveRoundUrl(s, round);
      if (!resolved.url) {
        throw new Error(`PDF URL 확정 실패: ${resolved.reason ?? 'unknown'}`);
      }

      // 2) 내려받아 PDF인지 확인(매직바이트) — HTML 오류페이지/ZIP 오적재 방지
      const probe = await this.probeFile(resolved.url, s.url);
      if (!probe.isPdf) {
        throw new Error(
          `PDF 아님 (status ${probe.status}, type ${probe.contentType ?? '?'}${probe.isZip ? ', ZIP' : ''})`,
        );
      }

      dir = await mkdtemp(join(tmpdir(), `pdf-${s.id}-${period}-`));
      const pdfPath = join(dir, 'report.pdf');
      const res = await fetch(resolved.url, {
        headers: { 'User-Agent': BROWSER_UA, Referer: s.url },
        signal: AbortSignal.timeout(120_000),
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`PDF fetch HTTP ${res.status}`);
      await writeFile(pdfPath, Buffer.from(await res.arrayBuffer()));

      // 3) 어댑터로 파싱 → pending 적재. 원본 딥링크는 소스 url(사람이 여는 페이지).
      const payload = await this.runParser(pdfPath, adapter, period, s.url);
      const batch = newBatchId(s.id, period);
      const up = await this.upsertPending(
        payload,
        s.id,
        batch,
        round.population ?? null,
      );

      const touched = up.pendingInserted + up.pendingUpdated;
      if (touched > 0) {
        await this.notifyReview(s, period, batch, up);
      } else {
        this.logger.log(`[pdf] ${s.id}/${period} — 새 pending 없음(알림 생략)`);
      }

      await this.events.record({
        sourceId: s.id,
        eventType: 'extracted',
        detail: {
          period,
          batch,
          pdfUrl: resolved.url,
          indicators: payload.indicators.length,
          ...up,
        },
        notified: touched > 0,
      });

      this.logger.log(
        `[pdf] ${s.id}/${period} 완료 — 지표 ${payload.indicators.length}, pending +${up.pendingInserted}/~${up.pendingUpdated}`,
      );
      return {
        ...base,
        ran: true,
        pdfUrl: resolved.url,
        indicators: payload.indicators.length,
        batch: touched > 0 ? batch : undefined,
        ...up,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.events.record({
        sourceId: s.id,
        eventType: 'failed',
        detail: { stage: 'pdf-extract', period, message: msg },
        notified: true,
      });
      await this.notifier.notifyText(
        `⚠️ 지표 자동추출 실패 (${s.id} ${period}회차): ${msg}`,
        `pdf:${s.id}`,
      );
      this.logger.error(`[pdf] ${s.id}/${period} 실패(격리됨): ${msg}`);
      return { ...base, reason: msg };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * 검수 요청 알림 (AS-PDF-RUN).
   * **추출된 값을 본문에 그대로 싣는다** — 사용자가 알림만 보고 원본과 대조할 수
   * 있어야 한다. 그리고 서명된 검수 링크를 붙여 클릭 한 번으로 끝나게 한다.
   */
  private async notifyReview(
    s: Source,
    period: string,
    batch: string,
    up: {
      pendingInserted: number;
      pendingUpdated: number;
      skippedApproved: number;
    },
  ): Promise<void> {
    const rows = await this.indicators.pendingByBatch(batch);
    const lines = rows
      .slice(0, MAX_NOTIFY_ROWS)
      .map((r) => {
        const group =
          r.qualifier === 'total' ? '전체' : r.qualifier.replace(/^group=/, '');
        return `· ${r.nameKo} | ${r.period} | ${group} | ${r.value}${r.unit ?? ''}`;
      })
      .join('\n');
    const more =
      rows.length > MAX_NOTIFY_ROWS
        ? `\n… 외 ${rows.length - MAX_NOTIFY_ROWS}건 (링크에서 전체 확인)`
        : '';

    const token = issueReviewToken(batch, reviewSecret(this.config));
    const link = `${this.apiBaseUrl()}/api/indicators/review/${token}`;

    await this.notifier.notifyText(
      [
        `🧾 지표 자동추출 — 검수 요망 (${s.orgKo} · ${s.titleKo})`,
        `회차 ${period} · pending 신규 ${up.pendingInserted} / 갱신 ${up.pendingUpdated}`,
        up.skippedApproved
          ? `이미 승인된 값 ${up.skippedApproved}건은 보호(건너뜀)`
          : '',
        '',
        '추출값 (지표 | 기간 | 분류 | 값):',
        lines + more,
        '',
        `원본: ${s.url}`,
        `검수(승인/폐기): ${link}`,
        '※ 승인 전까지 공개되지 않습니다. 링크는 14일 후 만료됩니다.',
      ]
        .filter((l) => l !== '')
        .join('\n'),
      `pdf:${s.id}`,
    );
  }

  /** 검수 링크에 쓸 API 기준 URL. */
  private apiBaseUrl(): string {
    return (
      this.config.get<string>('API_PUBLIC_URL')?.trim().replace(/\/+$/, '') ||
      'https://addiction-society-api.onrender.com'
    );
  }

  /** 회차의 PDF URL 확정(회차 설정 → 소스 기본값 순). */
  async resolveRoundUrl(
    s: Source,
    round: PdfRound,
  ): Promise<{ url?: string; reason?: string; candidates?: FileProbe[] }> {
    if (round.pdf_url?.trim()) return { url: round.pdf_url.trim() };
    const finder = round.pdf_finder ?? this.hintOf(s).pdf_finder;
    if (!finder?.type) return { reason: 'pdf_url·pdf_finder 둘 다 없음' };
    return this.runFinder(finder, s);
  }

  /** access_detail 기반으로 실제 PDF URL을 확정한다(직접 URL → finder). */
  /** 소스 기본 설정 기준 URL 확정 — health() 진단용(하위호환). */
  async resolvePdfUrl(
    s: Source,
  ): Promise<{ url?: string; reason?: string; candidates?: FileProbe[] }> {
    const rounds = this.roundsOf(s);
    if (rounds.length === 0) return { reason: '회차 설정 없음' };
    return this.resolveRoundUrl(s, rounds[0]);
  }

  /** finder 종류별 분기. 새 소스가 늘면 여기에 한 줄 추가한다. */
  private async runFinder(
    finder: PdfFinder,
    s: Source,
  ): Promise<{ url?: string; reason?: string; candidates?: FileProbe[] }> {
    if (finder.type === 'datagokr_filedata') {
      return this.findDataGoKrFile(finder.datasetUrl?.trim() || s.url);
    }
    if (finder.type === 'kcgp_board') {
      return this.findKcgpBoardFile(finder);
    }
    return { reason: `알 수 없는 pdf_finder.type: ${finder.type}` };
  }

  /**
   * kcgp 자료실 게시판 → 회차 게시글 → 첨부 PDF 도출 (AS-PDF-RUN).
   *
   * data.go.kr 파일데이터에는 최신 회차만 올라온다. 과거 회차(2022·2020·…)는
   * kcgp.or.kr 자료실에만 있으므로 별도 탐색기가 필요하다.
   *
   * 절차: 목록 HTML에서 titleContains(보통 연도)를 포함한 게시글 링크를 찾고 →
   * 그 상세 페이지의 첨부 다운로드 링크를 후보로 모아 → 실제로 받아 PDF
   * 매직바이트를 확인한다. **URL을 추측해서 만들지 않는다** — 페이지에 실제로
   * 있는 링크만 따라간다.
   */
  async findKcgpBoardFile(
    finder: PdfFinder,
  ): Promise<{ url?: string; reason?: string; candidates?: FileProbe[] }> {
    const listUrl = finder.listUrl?.trim();
    if (!listUrl) return { reason: 'kcgp_board: listUrl 없음' };
    const needle = finder.titleContains?.trim();
    if (!needle) return { reason: 'kcgp_board: titleContains 없음' };

    const origin = new URL(listUrl).origin;
    const listHtml = await this.getText(listUrl);
    if (!listHtml.ok) return { reason: `목록 ${listHtml.reason}` };

    // <a ...href="...">…2022…</a> 중 needle을 포함한 첫 항목
    const anchors = [
      ...listHtml.text.matchAll(
        /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ];
    const hit = anchors.find(([, , label]) =>
      label.replace(/<[^>]*>/g, ' ').includes(needle),
    );
    if (!hit) {
      return { reason: `목록에서 '${needle}' 회차 게시글을 찾지 못함` };
    }
    const viewUrl = new URL(hit[1].replace(/&amp;/g, '&'), listUrl).toString();

    const viewHtml = await this.getText(viewUrl);
    if (!viewHtml.ok) return { reason: `상세 ${viewHtml.reason}` };

    // 첨부 다운로드 링크 후보(경로에 download/file이 들어가는 링크)
    const hrefs = [
      ...new Set(
        [
          ...viewHtml.text.matchAll(
            /href="([^"]*(?:[Dd]ownload|fileDown)[^"]*)"/g,
          ),
        ].map((m) => new URL(m[1].replace(/&amp;/g, '&'), viewUrl).toString()),
      ),
    ]
      .filter((u) => u.startsWith(origin))
      .slice(0, 6);

    if (hrefs.length === 0) {
      return { reason: `상세 페이지에서 첨부 링크를 찾지 못함 (${viewUrl})` };
    }

    const candidates: FileProbe[] = [];
    for (const u of hrefs) candidates.push(await this.probeFile(u, viewUrl));
    const best = candidates.find((c) => c.isPdf);
    return best
      ? { url: best.url, candidates }
      : { reason: 'PDF 응답 후보 없음', candidates };
  }

  /** HTML 텍스트 GET 헬퍼. throw 안 함. */
  private async getText(
    url: string,
  ): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status} (${url})` };
      return { ok: true, text: await res.text() };
    } catch (e: unknown) {
      return {
        ok: false,
        reason: `${e instanceof Error ? e.message : String(e)} (${url})`,
      };
    }
  }

  /**
   * data.go.kr 파일데이터 페이지 → 첨부 다운로드 URL 도출 (AS-M3-2d).
   * 다운로드 링크는 `/cmm/cmm/fileDownload.do?atchFileId=FILE_xxxxxxxxx&fileDetailSn=N`이며
   * atchFileId는 데이터셋마다 다르고 페이지 HTML에만 있다 → 서버가 직접 긁어 확정한다
   * (추측 URL 금지). 후보를 실제로 받아 PDF 매직바이트까지 확인한다.
   */
  async findDataGoKrFile(
    datasetUrl: string,
  ): Promise<{ url?: string; reason?: string; candidates?: FileProbe[] }> {
    let html: string;
    try {
      const res = await fetch(datasetUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
      });
      if (!res.ok) return { reason: `데이터셋 페이지 HTTP ${res.status}` };
      html = await res.text();
    } catch (e: unknown) {
      return { reason: e instanceof Error ? e.message : String(e) };
    }

    const ids = [...new Set(html.match(/FILE_\d{6,}/g) ?? [])].slice(0, 5);
    if (ids.length === 0) {
      return { reason: '페이지에서 atchFileId(FILE_...)를 찾지 못함' };
    }

    const candidates: FileProbe[] = [];
    for (const id of ids) {
      const url = `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=${id}&fileDetailSn=1`;
      candidates.push(await this.probeFile(url, datasetUrl));
    }
    const best = candidates.find((c) => c.isPdf);
    return best
      ? { url: best.url, candidates }
      : {
          reason: 'PDF 응답 후보 없음(ZIP이면 압축 해제 경로 필요)',
          candidates,
        };
  }

  /** URL을 실제로 받아 200 + PDF 여부(매직바이트)까지 판정. throw 안 함. */
  async probeFile(url: string, referer?: string): Promise<FileProbe> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': BROWSER_UA,
          ...(referer ? { Referer: referer } : {}),
        },
        signal: AbortSignal.timeout(60_000),
        redirect: 'follow',
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const head = buf.subarray(0, 4).toString('latin1');
      const disp = res.headers.get('content-disposition');
      const nameMatch = disp?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      return {
        url,
        status: res.status,
        contentType: res.headers.get('content-type'),
        bytes: buf.length,
        isPdf: head.startsWith('%PDF'),
        isZip: head.startsWith('PK'),
        fileName: nameMatch ? decodeURIComponent(nameMatch[1]) : null,
      };
    } catch (e: unknown) {
      return {
        url,
        status: 0,
        contentType: null,
        bytes: 0,
        isPdf: false,
        isZip: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * 환경 자가진단 (AS-M3-2c/2d) — 셸 실측 대체.
   * python·pdfplumber 가용성 + PDF 대상 소스별 URL 확정 가능 여부(gov egress 포함).
   */
  async health(): Promise<Record<string, unknown>> {
    const bin = this.pythonBin();
    const pyVer = await this.probe(bin, ['--version']);
    const plug = await this.probe(bin, [
      '-c',
      'import pdfplumber,sys; sys.stdout.write(pdfplumber.__version__)',
    ]);

    const targets = await this.pdfSources();
    const sources: Array<Record<string, unknown>> = [];
    for (const s of targets) {
      const hint = this.hintOf(s);
      // AS-PDF-RUN: 회차별로 URL 확정 가능 여부를 따로 보고한다.
      const rounds: Array<Record<string, unknown>> = [];
      for (const r of this.roundsOf(s)) {
        const resolved = await this.resolveRoundUrl(s, r);
        rounds.push({
          period: String(r.period),
          population: r.population ?? null,
          resolvedUrl: resolved.url ?? null,
          reason: resolved.reason ?? null,
          candidates: resolved.candidates ?? undefined,
        });
      }
      sources.push({
        id: s.id,
        titleKo: s.titleKo,
        adapter: hint.parser_adapter ?? null,
        roundCount: rounds.length,
        rounds,
      });
    }

    return {
      ok: pyVer.ok && plug.ok,
      python: {
        bin,
        ok: pyVer.ok,
        version: pyVer.ok ? pyVer.out.trim() : undefined,
        error: pyVer.ok ? undefined : pyVer.out.slice(0, 200),
      },
      pdfplumber: {
        ok: plug.ok,
        version: plug.ok ? plug.out.trim() : undefined,
        error: plug.ok ? undefined : plug.out.slice(0, 200),
      },
      parserDir: {
        path: this.pdfExtractDir,
        exists: existsSync(this.pdfExtractDir),
      },
      cronEnabled:
        this.config.get<string>('INDICATOR_PDF_CRON_ENABLED') === 'true',
      pdfSourceCount: targets.length,
      sources,
    };
  }

  /** 프로세스 1회 실행 후 (성공여부, 출력). 진단 전용 — throw 하지 않음. */
  private probe(
    bin: string,
    args: string[],
  ): Promise<{ ok: boolean; out: string }> {
    return new Promise((resolvePromise) => {
      let out = '';
      try {
        const child = spawn(bin, args, { cwd: this.pdfExtractDir });
        child.stdout.on('data', (d: Buffer) => (out += d.toString()));
        child.stderr.on('data', (d: Buffer) => (out += d.toString()));
        child.on('error', (e) =>
          resolvePromise({ ok: false, out: `${bin}: ${e.message}` }),
        );
        child.on('close', (code) => resolvePromise({ ok: code === 0, out }));
      } catch (e: unknown) {
        resolvePromise({
          ok: false,
          out: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  /** Python 파서 실행(어댑터 지정) → 표준출력 JSON 파싱. */
  private runParser(
    pdfPath: string,
    adapter: string,
    period: string,
    sourceUrl: string,
  ): Promise<ExtractedPayload> {
    const python = this.pythonBin();
    const args = [
      'run.py',
      pdfPath,
      '--source',
      adapter,
      '--year',
      period,
      '--url',
      sourceUrl,
    ];
    return new Promise<ExtractedPayload>((resolvePromise, reject) => {
      const child = spawn(python, args, { cwd: this.pdfExtractDir });
      let out = '';
      let err = '';
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr.on('data', (d: Buffer) => (err += d.toString()));
      child.on('error', (e) =>
        reject(new Error(`파서 실행 불가(${python}): ${e.message}`)),
      );
      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(`파서 종료코드 ${code}: ${err.trim().slice(0, 300)}`),
          );
          return;
        }
        try {
          resolvePromise(JSON.parse(out) as ExtractedPayload);
        } catch {
          reject(new Error(`파서 출력 JSON 파싱 실패: ${out.slice(0, 200)}`));
        }
      });
    });
  }

  /** 추출 JSON → 지표 메타 upsert + 관측치 pending upsert(approved 보호). */
  private async upsertPending(
    payload: ExtractedPayload,
    sourceId: string,
    batch: string,
    population: string | null,
  ): Promise<{
    pendingInserted: number;
    pendingUpdated: number;
    skippedApproved: number;
  }> {
    let pendingInserted = 0;
    let pendingUpdated = 0;
    let skippedApproved = 0;
    const now = new Date();

    for (const row of payload.indicators) {
      if (!row.definitionKo?.trim()) continue; // 원칙4

      let indicator = await this.indicatorRepo.findOne({
        where: { code: row.code },
      });
      if (!indicator) {
        indicator = await this.indicatorRepo.save(
          this.indicatorRepo.create({
            code: row.code,
            domain: row.domain,
            nameKo: row.nameKo,
            nameEn: row.nameEn ?? undefined,
            unit: row.unit ?? undefined,
            definitionKo: row.definitionKo,
            methodNote: row.methodNote ?? undefined,
            sourceId,
          }),
        );
      }

      for (const o of row.observations) {
        const sourceUrl = o.sourceUrl ?? payload.sourceUrl;
        if (!sourceUrl) continue; // 원칙3
        const qualifier = o.qualifier ?? 'total';
        const period = String(o.period);
        const value = String(o.value);

        const existing = await this.observationRepo.findOne({
          where: {
            indicatorId: indicator.id,
            sourceId,
            geo: o.geo,
            period,
            qualifier,
          },
        });

        if (existing && existing.status === 'approved') {
          skippedApproved++; // 사람이 승인한 값은 기계 추출로 덮지 않는다
          continue;
        }
        // 조사대상(모집단)은 회차 설정이 우선, 없으면 어댑터가 준 값
        const note = population ?? o.note ?? null;

        if (existing) {
          await this.observationRepo.update(existing.id, {
            value,
            valueLow: o.valueLow ?? null,
            valueHigh: o.valueHigh ?? null,
            fetchedAt: now,
            sourceUrl,
            status: 'pending',
            reviewBatch: batch,
            note,
          });
          pendingUpdated++;
        } else {
          await this.observationRepo.save(
            this.observationRepo.create({
              indicatorId: indicator.id,
              sourceId,
              geo: o.geo,
              period,
              qualifier,
              value,
              valueLow: o.valueLow ?? null,
              valueHigh: o.valueHigh ?? null,
              revisions: null,
              fetchedAt: now,
              sourceUrl,
              status: 'pending',
              reviewBatch: batch,
              note,
            }),
          );
          pendingInserted++;
        }
      }
    }
    return { pendingInserted, pendingUpdated, skippedApproved };
  }
}
