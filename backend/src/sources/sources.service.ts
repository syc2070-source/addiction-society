import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Source } from './entities/source.entity';
import { SourceQueryDto } from './dto/source.dto';

/**
 * 소스 레지스트리 서비스 (읽기 전용).
 * research.service 패턴을 본떠 QueryBuilder로 필터/검색/정렬한다.
 */
@Injectable()
export class SourcesService {
  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
  ) {}

  /**
   * 목록 조회.
   * 정렬: nextExpectedAt ASC(NULLS LAST) → lastPublishedAt DESC(NULLS LAST)
   * 소규모 레지스트리(23건)이므로 서버 페이지네이션은 두지 않고 전량 반환한다.
   */
  async findAll(
    query: SourceQueryDto,
  ): Promise<{ data: Source[]; total: number }> {
    const { domain, scope, cadence, status, search } = query;

    const qb = this.sourceRepository.createQueryBuilder('source');

    if (domain) {
      qb.andWhere('source.domain = :domain', { domain });
    }

    // 범위 필터: korea(정확), intl(한국 제외), 그 외 정확일치
    if (scope === 'korea') {
      qb.andWhere("source.scope = 'korea'");
    } else if (scope === 'intl') {
      qb.andWhere("source.scope <> 'korea'");
    } else if (scope) {
      qb.andWhere('source.scope = :scope', { scope });
    }

    if (cadence) {
      qb.andWhere('source.cadence = :cadence', { cadence });
    }

    if (status) {
      qb.andWhere('source.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(source.titleKo ILIKE :q OR source.org ILIKE :q OR source.orgKo ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    qb.orderBy('source.nextExpectedAt', 'ASC', 'NULLS LAST').addOrderBy(
      'source.lastPublishedAt',
      'DESC',
      'NULLS LAST',
    );

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * 발간 캘린더: 다음 예상일이 있는 소스만 임박순으로.
   * M1에서는 nextExpectedAt이 전부 null이라 빈 배열이 정상이다.
   */
  async findCalendar(): Promise<Source[]> {
    return this.sourceRepository
      .createQueryBuilder('source')
      .where('source.nextExpectedAt IS NOT NULL')
      .orderBy('source.nextExpectedAt', 'ASC')
      .getMany();
  }

  /** 단건 상세 */
  async findOne(id: string): Promise<Source> {
    const source = await this.sourceRepository.findOne({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Source '${id}' not found`);
    }
    return source;
  }

  /**
   * 히어로 카드용 요약.
   * total, scope별 집계, 최근 발간 4건, 다음 예정 4건.
   * recent/upcoming은 실제 값만 반환한다(없으면 있는 만큼만, 가짜 채움 금지).
   */
  async getSummary(): Promise<{
    total: number;
    byScope: Record<string, number>;
    recent: { id: string; date: string; label: string; org: string }[];
    upcoming: { id: string; date: string; label: string; org: string }[];
  }> {
    const total = await this.sourceRepository.count();

    const scopeRaw = await this.sourceRepository
      .createQueryBuilder('s')
      .select('s.scope', 'scope')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.scope')
      .getRawMany();
    const byScope = scopeRaw.reduce(
      (acc, r) => {
        acc[r.scope] = parseInt(r.count, 10);
        return acc;
      },
      {} as Record<string, number>,
    );

    const recentRows = await this.sourceRepository
      .createQueryBuilder('s')
      .where('s.lastPublishedAt IS NOT NULL')
      .orderBy('s.lastPublishedAt', 'DESC')
      .limit(4)
      .getMany();
    const recent = recentRows.map((s) => ({
      id: s.id,
      date: s.lastPublishedAt as string,
      label: s.titleKo,
      org: s.orgKo,
    }));

    // upcoming은 비정례 발표 예정만. monthly는 매달 도래해 정보가치 없음
    const upcomingRows = await this.sourceRepository
      .createQueryBuilder('s')
      .where('s.nextExpectedAt IS NOT NULL')
      .andWhere("s.cadence <> 'monthly'")
      .orderBy('s.nextExpectedAt', 'ASC')
      .limit(4)
      .getMany();
    const upcoming = upcomingRows.map((s) => ({
      id: s.id,
      date: s.nextExpectedAt as string,
      label: s.titleKo,
      org: s.orgKo,
    }));

    return { total, byScope, recent, upcoming };
  }
}
