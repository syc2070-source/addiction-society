import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { SourcesNotifier } from '../sources/discord.notifier';

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

  constructor(private readonly notifier: SourcesNotifier) {}

  /** 매일 04:00 KST. 09:00 발표 감시 크론보다 먼저 끝나도록 새벽에 둔다. */
  @Cron('0 4 * * *', { name: 'dailyDataJobs', timeZone: 'Asia/Seoul' })
  async handleDaily(): Promise<void> {
    if (process.env.DAILY_JOBS_ENABLED === 'false') {
      this.logger.warn('[daily] DAILY_JOBS_ENABLED=false — 건너뜀');
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
      return [];
    }
    this.running = true;
    const results: StepResult[] = [];
    try {
      for (const step of steps) {
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
        this.logger.log(
          `[daily] ${r.ok ? '✅' : '❌'} ${r.name} (${Math.round(r.ms / 1000)}s${r.ok ? '' : `, exit ${r.code}`})`,
        );
      }
    } finally {
      this.running = false;
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      await this.notifier.notifyText(
        [
          `⚠️ 중독사회 매일 예약 실패 ${failed.length}/${results.length}`,
          ...failed.map(
            (f) => `- ${f.name} (exit ${f.code}): ${f.tail.slice(-300)}`,
          ),
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
      const keep = (buf: Buffer) => {
        tail = (tail + buf.toString()).slice(-2000);
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
        resolve({
          name: step.name,
          ok: code === 0,
          code,
          ms: Date.now() - started,
          tail: tail.trim(),
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
