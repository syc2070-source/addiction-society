import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Repository } from 'typeorm';
import {
  JobCounts,
  parseJobCountsLine,
  sumJobCounts,
} from '../common/job-counts';
import { SourcesNotifier } from '../sources/discord.notifier';
import { JobRun } from './entities/job-run.entity';
import { JobRunRecorder, RUN_END, RUN_SKIPPED, RUN_START } from './job-runs';

/**
 * 매일 예약 (SOC-R1 ■4) — 배포 때 돌던 데이터 쓰기를 여기로 옮겼다.
 *
 * 이전에는 deploy-init.sh 가 배포마다 seed·collect·backfill 을 돌려 "배포 = 데이터
 * 쓰기"였다. 이제 배포는 migration + 멱등 seed(tags)만 하고, 덮어쓰는 단계는
 * 매일 04:00 KST 에 한 번 돈다. 단계와 내용은 그대로다(같은 스크립트를 그대로 실행).
 *
 * 실행 방식: 각 단계를 자식 프로세스로 순서대로 돌린다(스크립트는 저마다
 * DataSource 를 열고 닫는 독립 실행 파일이라 앱 안에서 import 하지 않는다).
 * 빌드 산출물(dist/*.js)을 node 로 돌려 ts-node 컴파일 부담을 없앤다.
 * 단계 실패는 다음 단계를 막지 않고, 끝나면 실패 목록을 Discord 로 알린다.
 *
 * SOC-R2: seed 넷(sources·recovery·documents·indicators)은 넣기만 한다 — 기존 행은
 * 쓰지 않는다(common/seed-insert-only.ts). dist 실행 때 migration 경로는
 * data-source.ts 의 migrationGlobs 가 .js 로 고른다(전에는 .ts 를 require 해 initialize
 * 가 실패 — 10-11~13 운영 예약이 아무것도 쓰지 못한 원인으로 추정).
 *
 * SOC-R3: 회차마다 job_runs 에 시작·단계·끝 행을 넣는다(단계 출력의 [job_counts] 줄 →
 * counts). 누구나 GET /api/health/nightly 로 숫자를 본다. 기록 실패는 예약을 멈추지 않는다.
 */
export interface DailyStep {
  /** npm 스크립트 이름(기록·알림용). */
  name: string;
  /** src 기준 경로(확장자 없음). dist 에서는 같은 경로의 .js. */
  entry: string;
}

export const DAILY_STEPS: readonly DailyStep[] = [
  // seed:sources 는 next_expected_at 을 비우고 backfill:next 가 다시 채운다 — 순서 고정.
  { name: 'seed:sources', entry: 'sources/seed/sources.seed' },
  { name: 'backfill:next', entry: 'sources/seed/backfill-next' },
  { name: 'seed:recovery', entry: 'recovery/seed/recovery.seed' },
  { name: 'collect:indicators', entry: 'indicators/seed/collect-indicators' },
  { name: 'seed:documents', entry: 'policy/seed/documents.seed' },
  { name: 'collect:research', entry: 'research/seed/collect-research' },
  // 기존 행 relevance_* 보충 — relevance_checked_at NULL 만, 처음 한 번 뒤엔 0건.
  { name: 'backfill:relevance', entry: 'research/seed/backfill-relevance' },
  // 중독뉴스 공개 API 방송 → 연대기 「방송」 줄 (SOC-R1 ■7).
  { name: 'collect:broadcasts', entry: 'sources/seed/collect-broadcasts' },
];

export interface StepResult {
  name: string;
  ok: boolean;
  code: number | null;
  ms: number;
  tail: string;
  /** 단계 출력의 [job_counts] 줄(없으면 null — 그 스크립트가 수를 내지 않음). */
  counts?: JobCounts | null;
}

/** 실패 알림 끝에 붙는 공개 기록 주소. */
export function nightlyUrl(): string {
  const base = (
    process.env.RENDER_EXTERNAL_URL ||
    'https://addiction-society-api.onrender.com'
  ).replace(/\/+$/, '');
  return `${base}/api/health/nightly`;
}

const STEP_TIMEOUT_MS =
  Number(process.env.DAILY_JOB_STEP_TIMEOUT_SEC || 900) * 1000;

/** dist 산출물이 있으면 node, 없으면(로컬 개발) ts-node 로. */
export function commandFor(entry: string): { cmd: string; args: string[] } {
  const compiled = join(__dirname, '..', `${entry}.js`);
  if (existsSync(compiled)) {
    return { cmd: process.execPath, args: [compiled] };
  }
  return {
    cmd: process.execPath,
    args: [
      require.resolve('ts-node/dist/bin.js'),
      '--transpile-only',
      join(process.cwd(), 'src', `${entry}.ts`),
    ],
  };
}

@Injectable()
export class DailyJobsScheduler {
  private readonly logger = new Logger(DailyJobsScheduler.name);
  private running = false;
  private readonly recorder: JobRunRecorder;

  constructor(
    private readonly notifier: SourcesNotifier,
    @Optional()
    @InjectRepository(JobRun)
    jobRuns?: Pick<Repository<JobRun>, 'insert'>,
  ) {
    this.recorder = new JobRunRecorder(
      jobRuns ? { insert: (row) => jobRuns.insert(row) } : null,
    );
  }

  private async recordSkipped(reason: string): Promise<void> {
    const now = new Date();
    await this.recorder.write({
      runId: randomUUID(),
      startedAt: now,
      finishedAt: now,
      step: RUN_SKIPPED,
      status: 'skipped',
      counts: null,
      error: reason,
    });
  }

  /** 매일 04:00 KST. 09:00 발표 감시 크론보다 먼저 끝나도록 새벽에 둔다. */
  @Cron('0 4 * * *', { name: 'dailyDataJobs', timeZone: 'Asia/Seoul' })
  async handleDaily(): Promise<void> {
    if (process.env.DAILY_JOBS_ENABLED === 'false') {
      this.logger.warn('[daily] DAILY_JOBS_ENABLED=false — 건너뜀');
      await this.recordSkipped('DAILY_JOBS_ENABLED=false');
      return;
    }
    try {
      await this.runAll();
    } catch (e: unknown) {
      // 최상위 격리: 절대 throw 하지 않음
      this.logger.error(`[daily] 최상위 예외(무시): ${String(e)}`);
    }
  }

  async runAll(
    steps: readonly DailyStep[] = DAILY_STEPS,
    runner: (s: DailyStep) => Promise<StepResult> = (s) => this.runStep(s),
  ): Promise<StepResult[]> {
    if (this.running) {
      this.logger.warn('[daily] 이전 실행이 아직 도는 중 — 이번 회차 건너뜀');
      await this.recordSkipped('이전 회차가 아직 도는 중');
      return [];
    }
    this.running = true;
    const runId = randomUUID();
    const runStarted = new Date();
    const results: StepResult[] = [];
    try {
      await this.recorder.write({
        runId,
        startedAt: runStarted,
        finishedAt: null,
        step: RUN_START,
        status: 'ok',
        counts: null,
        error: null,
      });
      for (const step of steps) {
        const stepStarted = new Date();
        let r: StepResult;
        try {
          r = await runner(step);
        } catch (e: unknown) {
          r = {
            name: step.name,
            ok: false,
            code: null,
            ms: 0,
            tail: String(e),
          };
        }
        results.push(r);
        await this.recorder.write({
          runId,
          startedAt: stepStarted,
          finishedAt: new Date(),
          step: step.name,
          status: r.ok ? 'ok' : 'fail',
          counts: r.counts ?? null,
          error: r.ok ? null : `exit ${r.code}: ${r.tail}`,
        });
        this.logger.log(
          `[daily] ${r.ok ? '✅' : '❌'} ${r.name} (${Math.round(r.ms / 1000)}s${r.ok ? '' : `, exit ${r.code}`})`,
        );
      }
    } finally {
      this.running = false;
    }
    const failed = results.filter((r) => !r.ok);
    await this.recorder.write({
      runId,
      startedAt: runStarted,
      finishedAt: new Date(),
      step: RUN_END,
      status: failed.length > 0 ? 'fail' : 'ok',
      counts: sumJobCounts(results.map((r) => r.counts ?? null)),
      error: failed.length > 0 ? failed.map((f) => f.name).join(', ') : null,
    });
    if (failed.length > 0) {
      await this.notifier.notifyText(
        [
          `⚠️ 중독사회 매일 예약 실패 ${failed.length}/${results.length}`,
          ...failed.map(
            (f) => `- ${f.name} (exit ${f.code}): ${f.tail.slice(-300)}`,
          ),
          `기록: ${nightlyUrl()}`,
        ].join('\n'),
        'daily-jobs',
      );
    }
    return results;
  }

  runStep(step: DailyStep): Promise<StepResult> {
    const started = Date.now();
    const { cmd, args } = commandFor(step.entry);
    return new Promise((resolve) => {
      let tail = '';
      // [job_counts] 줄은 꼬리(2000자)에서 밀려날 수 있어 줄 단위로 따로 잡는다.
      let pending = '';
      let counts: JobCounts | null = null;
      const keep = (buf: Buffer) => {
        const text = buf.toString();
        tail = (tail + text).slice(-2000);
        const lines = (pending + text).split('\n');
        pending = lines.pop() ?? '';
        for (const l of lines) counts = parseJobCountsLine(l) ?? counts;
      };
      const child = spawn(cmd, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const timer = setTimeout(() => {
        tail += `\n[daily] 시간 초과 ${STEP_TIMEOUT_MS / 1000}s — 중단`;
        child.kill('SIGTERM');
      }, STEP_TIMEOUT_MS);
      child.stdout.on('data', keep);
      child.stderr.on('data', keep);
      const done = (code: number | null) => {
        clearTimeout(timer);
        counts = parseJobCountsLine(pending) ?? counts;
        resolve({
          name: step.name,
          ok: code === 0,
          code,
          ms: Date.now() - started,
          tail: tail.trim(),
          counts,
        });
      };
      child.on('error', (e) => {
        tail += `\n${String(e)}`;
        done(null);
      });
      child.on('close', (code) => done(code));
    });
  }
}
