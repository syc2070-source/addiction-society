import { Controller, Get, Query } from '@nestjs/common';
import { SourceEventsService } from './source-events.service';

/**
 * 관측소 활동 연대기 API (AS-M3-LEDGER).
 *  GET /api/timeline?limit=&all=&source=
 *   - 기본: 의미 있는 사건(published/changed/stale/failed/manual) 최신순.
 *   - all=true: 확인(checked, 변화 없음)까지 전부.
 *   - source=<id>: 특정 소스만.
 */
@Controller('api/timeline')
export class TimelineController {
  constructor(private readonly events: SourceEventsService) {}

  @Get()
  timeline(
    @Query('limit') limit?: string,
    @Query('all') all?: string,
    @Query('source') source?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.events.timeline({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      all: all === 'true' || all === '1',
      source: source?.trim() || undefined,
    });
  }
}
