import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Research } from './entities/research.entity';
import { Tag } from '../tags/entities/tag.entity';
import {
  CreateResearchDto,
  UpdateResearchDto,
  ResearchQueryDto,
} from './dto/research.dto';

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
    const { page = 1, limit = 20, domain, region, year, search, tag } = query;

    const qb = this.researchRepository
      .createQueryBuilder('research')
      .leftJoinAndSelect('research.tags', 'tags')
      .orderBy('research.createdAt', 'DESC');

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
    return this.researchRepository.find({
      where: { isFeatured: true },
      relations: ['tags'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
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

  async getStats(): Promise<{
    total: number;
    byDomain: Record<string, number>;
    byYear: Record<number, number>;
  }> {
    const total = await this.researchRepository.count();

    const byDomainRaw = await this.researchRepository
      .createQueryBuilder('research')
      .select('unnest(research.domains)', 'domain')
      .addSelect('COUNT(*)', 'count')
      .groupBy('domain')
      .getRawMany();

    const byDomain = byDomainRaw.reduce(
      (acc, item) => {
        acc[item.domain] = parseInt(item.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const byYearRaw = await this.researchRepository
      .createQueryBuilder('research')
      .select('research.year', 'year')
      .addSelect('COUNT(*)', 'count')
      .where('research.year IS NOT NULL')
      .groupBy('research.year')
      .orderBy('research.year', 'DESC')
      .getRawMany();

    const byYear = byYearRaw.reduce(
      (acc, item) => {
        acc[item.year] = parseInt(item.count);
        return acc;
      },
      {} as Record<number, number>,
    );

    return { total, byDomain, byYear };
  }
}