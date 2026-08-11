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
  async findAll(query: IndicatorQueryDto): Promise<{
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

    // 관측치 개수 집계(지표별). 공개는 approved만 카운트(원칙8 — 검수 전 비공개).
    const counts = await this.observationRepo
      .createQueryBuilder('o')
      .select('o.indicator_id', 'indicatorId')
      .addSelect('COUNT(*)', 'count')
      .where("o.status = 'approved'")
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
    // 공개는 approved만(검수 대기 pending은 노출 안 함, 원칙8).
    const observations = await this.observationRepo.find({
      where: { indicatorId: indicator.id, status: 'approved' },
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
      .where("o.status = 'approved'")
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

  /**
   * 검수 승인: pending 관측치를 approved로 전환(원칙8). code 지정 시 해당 지표만.
   * PDF 크론 추출분(pending)을 사람이 확인한 뒤 공개로 올리는 경로.
   */
  async approvePending(code?: string): Promise<{ approved: number }> {
    const qb = this.observationRepo
      .createQueryBuilder()
      .update(Observation)
      .set({ status: 'approved' })
      .where('status = :pending', { pending: 'pending' });
    if (code) {
      qb.andWhere(
        'indicator_id IN (SELECT id FROM indicators WHERE code = :code)',
        { code },
      );
    }
    const res = await qb.execute();
    return { approved: res.affected ?? 0 };
  }

  /**
   * 배치의 pending 관측치 목록 (AS-PDF-RUN) — Discord 검수 화면·알림 본문용.
   * 지표명을 함께 붙여 사람이 원본과 대조할 수 있게 한다.
   */
  async pendingByBatch(batch: string): Promise<
    Array<{
      id: number;
      code: string;
      nameKo: string;
      unit: string | null;
      geo: string;
      period: string;
      qualifier: string;
      value: string;
      note: string | null;
      sourceUrl: string;
      status: string;
    }>
  > {
    return this.observationRepo
      .createQueryBuilder('o')
      .innerJoin('indicators', 'i', 'i.id = o.indicator_id')
      .select([
        'o.id AS id',
        'i.code AS code',
        'i.name_ko AS "nameKo"',
        'i.unit AS unit',
        'o.geo AS geo',
        'o.period AS period',
        'o.qualifier AS qualifier',
        'o.value AS value',
        'o.note AS note',
        'o.source_url AS "sourceUrl"',
        'o.status AS status',
      ])
      .where('o.review_batch = :batch', { batch })
      .orderBy('i.code', 'ASC')
      .addOrderBy('o.period', 'ASC')
      .addOrderBy('o.qualifier', 'ASC')
      .getRawMany();
  }

  /**
   * 배치 단위 검수 처리 (AS-PDF-RUN).
   *  approve → status='approved' (공개)
   *  reject  → status='rejected' (비공개 유지. 삭제하지 않는 이유: 무엇을 왜
   *            버렸는지가 파서 수정의 근거다. 다음 추출이 같은 행을 다시
   *            pending으로 덮어써 재검수된다.)
   *
   * pending인 행만 건드린다 → 이미 처리된 배치의 링크를 다시 눌러도 0건(멱등·1회성).
   */
  async reviewBatch(
    batch: string,
    action: 'approve' | 'reject',
  ): Promise<{ affected: number }> {
    const res = await this.observationRepo
      .createQueryBuilder()
      .update(Observation)
      .set({ status: action === 'approve' ? 'approved' : 'rejected' })
      .where('review_batch = :batch', { batch })
      .andWhere('status = :pending', { pending: 'pending' })
      .execute();
    return { affected: res.affected ?? 0 };
  }
}
