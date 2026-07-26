import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indicator } from './entities/indicator.entity';
import { Observation } from './entities/observation.entity';
import { IndicatorQueryDto, ObservationQueryDto } from './dto/indicator.dto';

@Injectable()
export class IndicatorsService {
  constructor(
    @InjectRepository(Indicator)
    private readonly indicatorRepo: Repository<Indicator>,
    @InjectRepository(Observation)
    private readonly observationRepo: Repository<Observation>,
  ) {}

  /** 지표 목록(+관측치 개수). domain 필터. */
  async findAll(
    query: IndicatorQueryDto,
  ): Promise<{
    data: Array<Indicator & { observationCount: number }>;
    total: number;
  }> {
    const qb = this.indicatorRepo
      .createQueryBuilder('i')
      .orderBy('i.domain', 'ASC')
      .addOrderBy('i.nameKo', 'ASC');
    if (query.domain) {
      qb.andWhere('i.domain = :domain', { domain: query.domain });
    }
    const indicators = await qb.getMany();

    // 관측치 개수 집계(지표별).
    const counts = await this.observationRepo
      .createQueryBuilder('o')
      .select('o.indicator_id', 'indicatorId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.indicator_id')
      .getRawMany<{ indicatorId: number; count: string }>();
    const countMap = new Map(
      counts.map((c) => [Number(c.indicatorId), parseInt(c.count, 10)]),
    );

    const data = indicators.map((i) => ({
      ...i,
      observationCount: countMap.get(i.id) ?? 0,
    }));
    return { data, total: data.length };
  }

  /** 지표 상세 + 관측치 시계열(기간 오름차순). id 또는 code로 조회. */
  async findOne(
    idOrCode: string,
  ): Promise<{ indicator: Indicator; observations: Observation[] }> {
    const numeric = /^\d+$/.test(idOrCode);
    const indicator = await this.indicatorRepo.findOne({
      where: numeric ? { id: Number(idOrCode) } : { code: idOrCode },
    });
    if (!indicator) {
      throw new NotFoundException(`Indicator '${idOrCode}' not found`);
    }
    const observations = await this.observationRepo.find({
      where: { indicatorId: indicator.id },
      order: { geo: 'ASC', period: 'ASC' },
    });
    return { indicator, observations };
  }

  /** 관측치 목록. indicator(code/id)·geo 필터. */
  async findObservations(
    query: ObservationQueryDto,
  ): Promise<{ data: Observation[]; total: number }> {
    const qb = this.observationRepo
      .createQueryBuilder('o')
      .orderBy('o.indicatorId', 'ASC')
      .addOrderBy('o.geo', 'ASC')
      .addOrderBy('o.period', 'ASC');

    if (query.indicator) {
      if (/^\d+$/.test(query.indicator)) {
        qb.andWhere('o.indicator_id = :iid', { iid: Number(query.indicator) });
      } else {
        qb.andWhere(
          'o.indicator_id IN (SELECT id FROM indicators WHERE code = :code)',
          { code: query.indicator },
        );
      }
    }
    if (query.geo) {
      qb.andWhere('o.geo = :geo', { geo: query.geo });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
