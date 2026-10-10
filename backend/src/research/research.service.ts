import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Research } from './entities/research.entity';
import { Tag } from '../tags/entities/tag.entity';
import {
  isFieldRelevant,
  isPubliclyVisible,
  relevanceVerdict,
} from './relevance';
import {
  CreateResearchDto,
  UpdateResearchDto,
  ResearchQueryDto,
} from './dto/research.dto';

export type ReviewTab = 'pending' | 'keep' | 'hide';

/** 검수 창 한 줄 — 초록은 앞 200자만. */
export interface ReviewQueueItem {
  id: number;
  title: string;
  source: string | null;
  sourceUrl: string | null;
  year: number | null;
  abstractPreview: string;
  gateReason: string;
  reviewDecision: 'keep' | 'hide' | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}

/** 공개 목록이 관문 전에 읽는 승인분 상한(표 규모의 안전판). */
const PUBLIC_SCAN_LIMIT = 5000;

@Injectable()
export class ResearchService {
  constructor(
    @InjectRepository(Research)
    private researchRepository: Repository<Research>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  async create(createDto: CreateResearchDto): Promise<Research> {
    const { tagIds, ...researchData } = createDto;
    const research = this.researchRepository.create(researchData);

    if (tagIds && tagIds.length > 0) {
      research.tags = await this.tagRepository.findBy({ id: In(tagIds) });
    }

    return this.researchRepository.save(research);
  }

  async findAll(
    query: ResearchQueryDto,
  ): Promise<{ data: Research[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      domain,
      region,
      year,
      search,
      tag,
      status,
    } = query;

    const qb = this.researchRepository
      .createQueryBuilder('research')
      .leftJoinAndSelect('research.tags', 'tags')
      .orderBy('research.createdAt', 'DESC');

    // 공개 기본값: approved만 노출(원칙 8). status='all'이면 상태 필터 해제.
    if (status !== 'all') {
      qb.andWhere('research.status = :status', {
        status: status || 'approved',
      });
    }

    if (domain) {
      qb.andWhere(':domain = ANY(research.domains)', { domain });
    }

    if (region) {
      qb.andWhere('research.region = :region', { region });
    }

    if (year) {
      qb.andWhere('research.year = :year', { year });
    }

    if (search) {
      qb.andWhere(
        '(research.title ILIKE :search OR research.abstract ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (tag) {
      qb.andWhere('tags.name = :tag', { tag });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * 공개 목록·검색 (SOC-0). status 는 무조건 approved, 그 위에 관련성 관문.
   *
   * 관문은 코드 판정이라 SQL 페이지네이션 뒤에 걸면 total·페이지가 어긋난다.
   * research 는 수집 상한(회당 60건, DOI upsert)으로 작은 표라 승인분을 모두
   * 읽어 거른 뒤 메모리에서 자른다. 데이터는 바꾸지 않는다.
   * SOC-R1: 판정은 isPubliclyVisible 하나(승인 + (관문 통과 또는 keep) + hide 아님).
   */
  async findPublic(
    query: ResearchQueryDto,
  ): Promise<{ data: Research[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20 } = query;
    const all = await this.findAll({
      ...query,
      status: 'approved',
      page: 1,
      limit: PUBLIC_SCAN_LIMIT,
    });
    const visible = all.data.filter((r) => isPubliclyVisible(r));
    const start = (page - 1) * limit;
    return {
      data: visible.slice(start, start + limit),
      total: visible.length,
      page,
      limit,
    };
  }

  /** 공개 단건 (SOC-0): 미승인·관문 실패는 존재하지 않는 것과 같게 404. */
  async findPublicOne(id: number): Promise<Research> {
    const research = await this.researchRepository.findOne({
      where: { id, status: 'approved' },
      relations: ['tags'],
    });

    if (!research || !isPubliclyVisible(research)) {
      throw new NotFoundException(`Research #${id} not found`);
    }

    await this.researchRepository.increment({ id }, 'viewCount', 1);
    return research;
  }

  async findOne(id: number): Promise<Research> {
    const research = await this.researchRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!research) {
      throw new NotFoundException(`Research #${id} not found`);
    }

    await this.researchRepository.increment({ id }, 'viewCount', 1);
    return research;
  }

  async findFeatured(): Promise<Research[]> {
    const featured = await this.researchRepository.find({
      where: { isFeatured: true, status: 'approved' },
      relations: ['tags'],
      order: { createdAt: 'DESC' },
    });
    return featured.filter((r) => isPubliclyVisible(r)).slice(0, 10);
  }

  async update(id: number, updateDto: UpdateResearchDto): Promise<Research> {
    const research = await this.findOne(id);
    const { tagIds, ...updateData } = updateDto;

    Object.assign(research, updateData);

    if (tagIds !== undefined) {
      research.tags =
        tagIds.length > 0
          ? await this.tagRepository.findBy({ id: In(tagIds) })
          : [];
    }

    return this.researchRepository.save(research);
  }

  async remove(id: number): Promise<void> {
    const result = await this.researchRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Research #${id} not found`);
    }
  }

  /**
   * 검수 창 목록 (SOC-R1). 대상은 관문에 걸린 승인분뿐이다.
   *  - pending : 승인 + 관문 실패 + 미검토(review_decision NULL)
   *  - keep    : 살린 것 · hide : 숨긴 것 (관문 실패분만 — 통과분은 검수 대상 아님)
   * 관문 사유는 지금 판정을 다시 계산해 보인다(저장값과 어긋날 일이 없게).
   */
  async findReviewQueue(
    tab: ReviewTab = 'pending',
  ): Promise<ReviewQueueItem[]> {
    const approved = await this.researchRepository.find({
      where: { status: 'approved' },
      order: { id: 'DESC' },
    });
    return approved
      .filter((r) => !isFieldRelevant(r))
      .filter((r) =>
        tab === 'pending' ? r.reviewDecision == null : r.reviewDecision === tab,
      )
      .map((r) => ({
        id: r.id,
        title: r.title,
        source: r.source ?? null,
        sourceUrl: r.sourceUrl ?? null,
        year: r.year ?? null,
        abstractPreview: (r.abstract ?? '').slice(0, 200),
        gateReason: relevanceVerdict(r).reason,
        reviewDecision: r.reviewDecision ?? null,
        reviewedBy: r.reviewedBy ?? null,
        reviewedAt: r.reviewedAt ?? null,
      }));
  }

  /**
   * 검수 결정 기록 (SOC-R1). review_* 세 칸만 쓴다 — status·approved 는 그대로.
   * decision=null 은 되돌리기(검토 대기로). 공개 길은 매 요청 DB 를 읽으므로
   * 따로 비울 캐시가 없다 — 결정은 다음 요청부터 바로 반영된다.
   */
  async review(
    id: number,
    decision: 'keep' | 'hide' | null | undefined,
    reviewer: string,
  ): Promise<{
    id: number;
    reviewDecision: 'keep' | 'hide' | null;
    reviewedBy: string;
    reviewedAt: Date;
  }> {
    if (
      decision === undefined ||
      !(decision === null || decision === 'keep' || decision === 'hide')
    ) {
      throw new BadRequestException("decision 은 'keep' | 'hide' | null");
    }
    const exists = await this.researchRepository.findOne({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Research #${id} not found`);
    const reviewedAt = new Date();
    await this.researchRepository.update(id, {
      reviewDecision: decision,
      reviewedBy: reviewer,
      reviewedAt,
    });
    return { id, reviewDecision: decision, reviewedBy: reviewer, reviewedAt };
  }

  /** 공개 통계 (SOC-0): 공개 목록에 보이는 자료(승인 + 관문 통과)만 센다. */
  async getStats(): Promise<{
    total: number;
    byDomain: Record<string, number>;
    byYear: Record<number, number>;
  }> {
    const approved = await this.researchRepository.find({
      where: { status: 'approved' },
    });
    const visible = approved.filter((r) => isPubliclyVisible(r));

    const byDomain: Record<string, number> = {};
    const byYear: Record<number, number> = {};
    for (const r of visible) {
      for (const d of r.domains ?? []) byDomain[d] = (byDomain[d] ?? 0) + 1;
      if (r.year != null) byYear[r.year] = (byYear[r.year] ?? 0) + 1;
    }

    return { total: visible.length, byDomain, byYear };
  }
}
