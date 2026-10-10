import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceEventsService } from './source-events.service';
import { BroadcastItem } from './entities/broadcast-item.entity';

/** 연대기 「방송」 줄에 싣는 최근 방송 수. */
const BROADCAST_LIMIT = 30;

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
 *
 * SOC-R1: broadcasts — 중독뉴스 방송(매일 예약이 넣음). 0건이면 화면이 줄을 숨긴다.
 */
@Controller('api/timeline')
export class TimelineController {
  constructor(
    private readonly events: SourceEventsService,
    @InjectRepository(BroadcastItem)
    private readonly broadcasts: Repository<BroadcastItem>,
  ) {}

  @Get()
  async timeline(
    @Query('limit') limit?: string,
    @Query('all') all?: string,
    @Query('source') source?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const [result, summary, broadcasts] = await Promise.all([
      this.events.timeline({
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        all: all === 'true' || all === '1',
        source: source?.trim() || undefined,
      }),
      this.events.activitySummary(30),
      this.broadcasts
        .find({
          order: {
            publishedAt: { direction: 'DESC', nulls: 'LAST' },
            id: 'DESC',
          },
          take: BROADCAST_LIMIT,
        })
        .catch(() => [] as BroadcastItem[]),
    ]);
    return { ...result, summary, broadcasts };
  }
}
