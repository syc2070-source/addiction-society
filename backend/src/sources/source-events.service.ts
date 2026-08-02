import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceEvent } from './entities/source-event.entity';

/** record()에 넘기는 이벤트 입력(부분). detectedAt/notified 기본값 있음. */
export interface RecordEventInput {
  sourceId: string;
  eventType: string;
  prevHash?: string | null;
  newHash?: string | null;
  prevPublishedAt?: string | null;
  newPublishedAt?: string | null;
  detail?: Record<string, unknown> | null;
  notified?: boolean;
}

/** 타임라인 1행(소스 표시 정보 조인). */
export interface TimelineRow {
  id: number;
  sourceId: string;
  org: string | null;
  orgKo: string | null;
  titleKo: string | null;
  titleEn: string | null;
  url: string | null;
  eventType: string;
  detectedAt: Date;
  prevPublishedAt: string | null;
  newPublishedAt: string | null;
  notified: boolean;
  detail: Record<string, unknown> | null;
}

// 타임라인 기본 노출(의미 있는 사건). 'checked'(변화 없음 확인)는 all=true일 때만.
// rescheduled: 예정 월이 지나도록 발간을 잡지 못해 다음 주기로 이월한 사건.
// 발간을 놓쳤다는 뜻이라 그 자체가 감시 정보이므로 기본 노출에 포함한다.
const SIGNIFICANT = [
  'published',
  'changed',
  'stale',
  'failed',
  'manual',
  'rescheduled',
];

@Injectable()
export class SourceEventsService {
  private readonly logger = new Logger(SourceEventsService.name);

  constructor(
    @InjectRepository(SourceEvent)
    private readonly repo: Repository<SourceEvent>,
  ) {}

  /**
   * 이벤트 1행 append. **절대 throw 하지 않는다**(크론 격리 — 기록 실패가 감시를 죽이면 안 됨).
   */
  async record(input: RecordEventInput): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          sourceId: input.sourceId,
          eventType: input.eventType,
          prevHash: input.prevHash ?? null,
          newHash: input.newHash ?? null,
          prevPublishedAt: input.prevPublishedAt ?? null,
          newPublishedAt: input.newPublishedAt ?? null,
          detail: input.detail ?? null,
          notified: input.notified ?? false,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[event] 기록 실패(무시) ${input.sourceId}: ${msg}`);
    }
  }

  /**
   * 타임라인 조회. 기본은 의미 있는 사건만(최신순). all=true면 checked 포함.
   */
  async timeline(query: {
    limit?: number;
    all?: boolean;
    source?: string;
  }): Promise<{ data: TimelineRow[]; total: number }> {
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoin('sources', 's', 's.id = e.source_id')
      .select([
        'e.id AS id',
        'e.source_id AS "sourceId"',
        's.org AS org',
        's.org_ko AS "orgKo"',
        's.title_ko AS "titleKo"',
        's.title_en AS "titleEn"',
        's.url AS url',
        'e.event_type AS "eventType"',
        'e.detected_at AS "detectedAt"',
        'e.prev_published_at AS "prevPublishedAt"',
        'e.new_published_at AS "newPublishedAt"',
        'e.notified AS notified',
        'e.detail AS detail',
      ])
      .orderBy('e.detected_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .limit(limit);

    if (!query.all) {
      qb.andWhere('e.event_type IN (:...types)', { types: SIGNIFICANT });
    }
    if (query.source) {
      qb.andWhere('e.source_id = :src', { src: query.source });
    }

    const data = (await qb.getRawMany()) as TimelineRow[];
    return { data, total: data.length };
  }
}
