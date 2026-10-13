import {
  Controller,
  Get,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JobRun } from './scheduler/entities/job-run.entity';
import { nightlySummary, NightlySummary } from './scheduler/job-runs';
import { Source } from './sources/entities/source.entity';
import { monitorCounts } from './sources/missed-releases';

const startedAt = new Date().toISOString();

/** SOC-R1 migration 이 넣은 research 검수 칸. 여섯 개가 모두 있어야 true. */
const REVIEW_COLUMNS = [
  'reviewed_by',
  'reviewed_at',
  'review_decision',
  'relevance_score',
  'relevance_reason',
  'relevance_checked_at',
];

/**
 * 배포 확인 길 (SOC-0). Render 가 주입하는 RENDER_GIT_COMMIT 으로 지금 떠 있는
 * 커밋을 돌려준다. 인증·비밀 값은 없다.
 * SOC-R1: schema.review_columns — 검수 칸 migration 이 적용됐는지(열 이름만 조회).
 * (Render 헬스체크는 기존대로 /api/sources/summary — DB 까지 확인.)
 */
@Controller('api/health')
export class HealthController {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  @Get()
  async get() {
    return {
      ok: true,
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      startedAt,
      schema: { review_columns: await this.reviewColumns() },
    };
  }

  /**
   * 밤 예약 기록 (SOC-R3 ■1) — 마지막 회차(시작·끝·단계 표) + 최근 7일 회차·실패 수.
   * 숫자·시각·단계 이름만. 출력 원문(error)·사람 칸은 내보내지 않는다.
   * job_runs 표가 없으면(migration 전) 503.
   */
  @Get('nightly')
  async nightly(): Promise<
    NightlySummary & { monitor: ReturnType<typeof monitorCounts> | null }
  > {
    if (!this.dataSource?.isInitialized) {
      throw new ServiceUnavailableException('db not ready');
    }
    let summary: NightlySummary;
    try {
      summary = await nightlySummary(this.dataSource.getRepository(JobRun));
    } catch {
      throw new ServiceUnavailableException('job_runs not ready');
    }
    return { ...summary, monitor: await this.monitor() };
  }

  /** 발표 감시 건강 (SOC-R4 ■2) — stale·읽지 못한 소스 수. 실패하면 null(밤 기록은 그대로). */
  private async monitor(): Promise<ReturnType<typeof monitorCounts> | null> {
    try {
      const rows = await this.dataSource!.getRepository(Source).find({
        select: { id: true, status: true, failCount: true },
      });
      return monitorCounts(rows);
    } catch {
      return null;
    }
  }

  private async reviewColumns(): Promise<boolean> {
    if (!this.dataSource?.isInitialized) return false;
    try {
      const rows: { column_name: string }[] = await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'research' AND column_name = ANY($1)`,
        [REVIEW_COLUMNS],
      );
      return rows.length === REVIEW_COLUMNS.length;
    } catch {
      return false;
    }
  }
}
