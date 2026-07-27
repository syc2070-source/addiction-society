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
export interface PdfSourceHint {
  pdf?: boolean;
  parser_adapter?: string;
  pdf_url?: string | null;
  pdf_finder?: { type: string; datasetUrl?: string } | null;
  period?: string | number | null;
}

interface ExtractedObs {
  geo: string;
  period: string | number;
  value: string | number;
  qualifier?: string | null;
  valueLow?: string | null;
  valueHigh?: string | null;
  sourceUrl?: string;
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
  ran: boolean;
  reason?: string;
  pdfUrl?: string;
  indicators: number;
  pendingInserted: number;
  pendingUpdated: number;
  skippedApproved: number;
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

  /** 대상 소스 전부 순차 추출. 소스별 격리. 크론·수동 트리거 공용. */
  async extractAll(): Promise<SourceExtractionResult[]> {
    const targets = await this.pdfSources();
    this.logger.log(
      `[pdf] 대상 소스 ${targets.length}건 (access_detail.pdf=true)`,
    );
    const results: SourceExtractionResult[] = [];
    for (const s of targets) {
      results.push(await this.extractSource(s));
    }
    return results;
  }

  /** 소스 id로 1건 추출. */
  async extractOne(sourceId: string): Promise<SourceExtractionResult> {
    const s = await this.sourceRepo.findOne({ where: { id: sourceId } });
    if (!s) {
      return {
        sourceId,
        ran: false,
        reason: 'sources에 없는 id',
        indicators: 0,
        pendingInserted: 0,
        pendingUpdated: 0,
        skippedApproved: 0,
      };
    }
    return this.extractSource(s);
  }

  /** 소스 1건 추출 본체. 절대 throw 안 함. */
  private async extractSource(s: Source): Promise<SourceExtractionResult> {
    const base: SourceExtractionResult = {
      sourceId: s.id,
      ran: false,
      indicators: 0,
      pendingInserted: 0,
      pendingUpdated: 0,
      skippedApproved: 0,
    };
    const hint = this.hintOf(s);
    const adapter = hint.parser_adapter?.trim();
    if (!adapter) return { ...base, reason: 'parser_adapter 미지정' };
    const period = hint.period != null ? String(hint.period).trim() : '';
    if (!period) return { ...base, reason: 'period(회차 연도) 미지정' };

    let dir: string | null = null;
    try {
      // 1) PDF URL 확정: 직접 URL 우선, 없으면 탐색기(finder)로 도출
      const resolved = await this.resolvePdfUrl(s);
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

      dir = await mkdtemp(join(tmpdir(), `pdf-${s.id}-`));
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
      const up = await this.upsertPending(payload, s.id);

      await this.notifier.notifyText(
        [
          `🧾 지표 자동추출 (${s.orgKo} · ${s.titleKo})`,
          `회차 ${period} · 지표 ${payload.indicators.length} · pending 신규 ${up.pendingInserted} / 갱신 ${up.pendingUpdated}`,
          up.skippedApproved
            ? `이미 승인된 값 ${up.skippedApproved}건 보호(건너뜀)`
            : '',
          '검수 요망 — 승인 전까지 공개 안 됨.',
        ]
          .filter(Boolean)
          .join('\n'),
        `pdf:${s.id}`,
      );
      this.logger.log(
        `[pdf] ${s.id} 완료 — 지표 ${payload.indicators.length}, pending +${up.pendingInserted}/~${up.pendingUpdated}`,
      );
      return {
        ...base,
        ran: true,
        pdfUrl: resolved.url,
        indicators: payload.indicators.length,
        ...up,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.events.record({
        sourceId: s.id,
        eventType: 'failed',
        detail: { stage: 'pdf-extract', message: msg },
        notified: true,
      });
      await this.notifier.notifyText(
        `⚠️ 지표 자동추출 실패 (${s.id}): ${msg}`,
        `pdf:${s.id}`,
      );
      this.logger.error(`[pdf] ${s.id} 실패(격리됨): ${msg}`);
      return { ...base, reason: msg };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** access_detail 기반으로 실제 PDF URL을 확정한다(직접 URL → finder). */
  async resolvePdfUrl(
    s: Source,
  ): Promise<{ url?: string; reason?: string; candidates?: FileProbe[] }> {
    const hint = this.hintOf(s);
    if (hint.pdf_url?.trim()) return { url: hint.pdf_url.trim() };

    const finder = hint.pdf_finder;
    if (!finder?.type) return { reason: 'pdf_url·pdf_finder 둘 다 없음' };

    if (finder.type === 'datagokr_filedata') {
      const datasetUrl = finder.datasetUrl?.trim() || s.url;
      return this.findDataGoKrFile(datasetUrl);
    }
    return { reason: `알 수 없는 pdf_finder.type: ${finder.type}` };
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
      const resolved = await this.resolvePdfUrl(s);
      sources.push({
        id: s.id,
        titleKo: s.titleKo,
        adapter: hint.parser_adapter ?? null,
        period: hint.period ?? null,
        resolvedUrl: resolved.url ?? null,
        reason: resolved.reason ?? null,
        candidates: resolved.candidates ?? undefined,
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
        if (existing) {
          await this.observationRepo.update(existing.id, {
            value,
            valueLow: o.valueLow ?? null,
            valueHigh: o.valueHigh ?? null,
            fetchedAt: now,
            sourceUrl,
            status: 'pending',
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
            }),
          );
          pendingInserted++;
        }
      }
    }
    return { pendingInserted, pendingUpdated, skippedApproved };
  }
}
