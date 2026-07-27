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
import { SourceEventsService } from '../sources/source-events.service';
import { SourcesNotifier } from '../sources/discord.notifier';

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

export interface ExtractionResult {
  ran: boolean;
  reason?: string;
  indicators: number;
  pendingInserted: number;
  pendingUpdated: number;
  skippedApproved: number;
}

/**
 * kcgp PDF 추출 → observations(status='pending') 적재 (AS-M3-2b).
 *
 * 흐름: PDF URL fetch → 임시파일 → Python 파서(tools/pdf-extract/run.py) spawn →
 *   JSON 파싱 → 지표 메타 upsert(없으면 생성, 정의는 어댑터 큐레이션) +
 *   관측치 pending upsert(이미 approved면 보호·건너뜀) → Discord "검수 요망".
 * 실패는 source_events(kcgp_youth, failed)로 남기고 **절대 throw 하지 않는다**(크론 격리).
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
   * 파서를 실행할 python 경로 결정 (AS-M3-2c).
   * 우선순위: PYTHON_BIN(명시) → 빌드가 만든 venv(backend/pdf-venv) → 시스템 python3.
   * venv를 쓰면 PEP 668·--user 경로 문제 없이 pdfplumber가 보장된다.
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

  /** kcgp 최신 회차 1회 추출. 크론·수동 트리거 공용. 절대 throw 안 함. */
  async extractKcgpYouth(): Promise<ExtractionResult> {
    const base: ExtractionResult = {
      ran: false,
      indicators: 0,
      pendingInserted: 0,
      pendingUpdated: 0,
      skippedApproved: 0,
    };
    const pdfUrl = this.config.get<string>('KCGP_YOUTH_PDF_URL')?.trim();
    if (!pdfUrl) {
      return { ...base, reason: 'KCGP_YOUTH_PDF_URL 미설정' };
    }
    const year =
      this.config.get<string>('KCGP_YOUTH_PDF_YEAR')?.trim() || '2024';
    const sourceUrl =
      this.config.get<string>('KCGP_YOUTH_SOURCE_URL')?.trim() || pdfUrl;

    let dir: string | null = null;
    try {
      dir = await mkdtemp(join(tmpdir(), 'kcgp-pdf-'));
      const pdfPath = join(dir, 'report.pdf');

      // 1) PDF 다운로드
      const res = await fetch(pdfUrl, {
        signal: AbortSignal.timeout(60_000),
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`PDF fetch HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(pdfPath, buf);

      // 2) Python 파서 spawn → JSON
      const payload = await this.runParser(pdfPath, year, sourceUrl);
      const upserted = await this.upsertPending(payload);

      // 3) 성공 알림
      await this.notifier.notifyText(
        [
          '🧾 지표 자동추출 (kcgp 청소년 도박)',
          `추출 지표 ${payload.indicators.length} · pending 신규 ${upserted.pendingInserted} / 갱신 ${upserted.pendingUpdated}`,
          upserted.skippedApproved
            ? `이미 승인된 값 ${upserted.skippedApproved}건은 보호(건너뜀)`
            : '',
          '검수 요망 — 승인 전까지 공개 안 됨.',
        ]
          .filter(Boolean)
          .join('\n'),
        'kcgp-pdf',
      );

      this.logger.log(
        `[pdf:kcgp] 추출 완료 — 지표 ${payload.indicators.length}, pending +${upserted.pendingInserted}/~${upserted.pendingUpdated}, approved보호 ${upserted.skippedApproved}`,
      );
      return { ran: true, ...upserted, indicators: payload.indicators.length };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // 실패 → LEDGER(source_events)에 남긴다.
      await this.events.record({
        sourceId: 'kcgp_youth',
        eventType: 'failed',
        detail: { stage: 'pdf-extract', message: msg },
        notified: true,
      });
      await this.notifier.notifyText(
        `⚠️ 지표 자동추출 실패 (kcgp 청소년 도박): ${msg}`,
        'kcgp-pdf',
      );
      this.logger.error(`[pdf:kcgp] 실패(격리됨): ${msg}`);
      return { ...base, reason: msg };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * 환경 자가진단 (AS-M3-2c) — 셸 실측을 대체한다.
   * python 존재/버전, pdfplumber import 가능 여부, gov(kcgp) URL fetch 가능 여부를 반환.
   */
  async health(): Promise<{
    ok: boolean;
    python: { bin: string; ok: boolean; version?: string; error?: string };
    pdfplumber: { ok: boolean; version?: string; error?: string };
    parserDir: { path: string; exists: boolean };
    cronEnabled: boolean;
    pdfUrlConfigured: boolean;
    govFetch: Array<{
      url: string;
      ok: boolean;
      status: number;
      error?: string;
    }>;
  }> {
    const bin = this.pythonBin();
    const parserDir = this.pdfExtractDir;

    const pyVer = await this.probe(bin, ['--version']);
    const plug = await this.probe(bin, [
      '-c',
      'import pdfplumber,sys; sys.stdout.write(pdfplumber.__version__)',
    ]);

    // gov egress 판정: 설정된 PDF URL + kcgp/data.go.kr 대표 URL
    const targets = [
      this.config.get<string>('KCGP_YOUTH_PDF_URL')?.trim(),
      'https://www.kcgp.or.kr/portal/bbs/B0000063/list.do?menuNo=200240',
      'https://www.data.go.kr/data/15142248/fileData.do',
    ].filter((u): u is string => !!u);

    const govFetch: Array<{
      url: string;
      ok: boolean;
      status: number;
      error?: string;
    }> = [];
    for (const url of targets) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(20_000),
          redirect: 'follow',
        });
        govFetch.push({ url, ok: res.ok, status: res.status });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        govFetch.push({ url, ok: false, status: 0, error: msg });
      }
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
      parserDir: { path: parserDir, exists: existsSync(parserDir) },
      cronEnabled:
        this.config.get<string>('INDICATOR_PDF_CRON_ENABLED') === 'true',
      pdfUrlConfigured: !!this.config.get<string>('KCGP_YOUTH_PDF_URL')?.trim(),
      govFetch,
    };
  }

  /** 프로세스 1회 실행 후 (성공여부, 출력) 반환. 진단 전용 — throw 하지 않음. */
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

  /** Python 파서 실행 → 표준출력 JSON 파싱. */
  private runParser(
    pdfPath: string,
    year: string,
    sourceUrl: string,
  ): Promise<ExtractedPayload> {
    const python = this.pythonBin();
    const args = [
      'run.py',
      pdfPath,
      '--source',
      'kcgp_youth',
      '--year',
      year,
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
  private async upsertPending(payload: ExtractedPayload): Promise<{
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
        // 지표 메타(정의는 어댑터 큐레이션)는 생성. 값(관측치)만 pending.
        indicator = await this.indicatorRepo.save(
          this.indicatorRepo.create({
            code: row.code,
            domain: row.domain,
            nameKo: row.nameKo,
            nameEn: row.nameEn ?? undefined,
            unit: row.unit ?? undefined,
            definitionKo: row.definitionKo,
            methodNote: row.methodNote ?? undefined,
            sourceId: row.sourceId ?? payload.sourceId ?? null,
          }),
        );
      }

      for (const o of row.observations) {
        const sourceUrl = o.sourceUrl ?? payload.sourceUrl;
        if (!sourceUrl) continue; // 원칙3
        const sourceId = row.sourceId ?? payload.sourceId ?? null;
        const qualifier = o.qualifier ?? 'total';
        const period = String(o.period);
        const value = String(o.value);

        const existing = await this.observationRepo.findOne({
          where: {
            indicatorId: indicator.id,
            sourceId: sourceId ?? undefined,
            geo: o.geo,
            period,
            qualifier,
          },
        });

        if (existing && existing.status === 'approved') {
          // 이미 사람이 승인한 값은 기계 추출로 덮지 않는다(보호).
          skippedApproved++;
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
