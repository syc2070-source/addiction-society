import { Controller, Get, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
