import { Controller, Get, Query } from '@nestjs/common';
import { SourceEventsService } from './source-events.service';

/**
 * 관측소 활동 연대기 API (AS-M3-LEDGER).
 *  GET /api/timeline?limit=&all=&source=
 *   - 기본: 의미 있는 사건(published/changed/stale/failed/manual/rescheduled/blocked) 최신순.
 *   - all=true: 확인(checked, 변화 없음)까지 전부.
 *   - source=<id>: 특정 소스만.
 *
 * AS-FIX-1(감사 문제 #8): 응답에 summary를 함께 싣는다. 사건이 없는 달에도
 * "최근 30일 동안 몇 번 확인했고 마지막 확인이 언제인지"가 화면에 드러나야
 * 크론이 도는 중인지 죽었는지 구분된다.
 */
@Controller('api/timeline')
export class TimelineController {
  constructor(private readonly events: SourceEventsService) {}

  @Get()
  async timeline(
    @Query('limit') limit?: string,
    @Query('all') all?: string,
    @Query('source') source?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const [result, summary] = await Promise.all([
      this.events.timeline({
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        all: all === 'true' || all === '1',
        source: source?.trim() || undefined,
      }),
      this.events.activitySummary(30),
    ]);
    return { ...result, summary };
  }
}
