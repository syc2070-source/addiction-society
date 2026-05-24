import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RecoveryResource } from './entities/recovery-resource.entity';
import { Tag } from '../tags/entities/tag.entity';
import {
  CreateRecoveryResourceDto,
  UpdateRecoveryResourceDto,
  RecoveryResourceQueryDto,
} from './dto/recovery.dto';

@Injectable()
export class RecoveryService {
  constructor(
    @InjectRepository(RecoveryResource)
    private resourceRepository: Repository<RecoveryResource>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  async create(createDto: CreateRecoveryResourceDto): Promise<RecoveryResource> {
    const { tagIds, ...resourceData } = createDto;
    const resource = this.resourceRepository.create(resourceData);

    if (tagIds && tagIds.length > 0) {
      resource.tags = await this.tagRepository.findBy({ id: In(tagIds) });
    }

    return this.resourceRepository.save(resource);
  }

  async findAll(
    query: RecoveryResourceQueryDto,
  ): Promise<{ data: RecoveryResource[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      type,
      city,
      region,
      domain,
      search,
      isVerified,
    } = query;

    const qb = this.resourceRepository
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.tags', 'tags')
      .where('resource.isActive = :isActive', { isActive: true })
      .orderBy('resource.name', 'ASC');

    if (type) {
      qb.andWhere('resource.type = :type', { type });
    }

    if (city) {
      qb.andWhere('resource.city = :city', { city });
    }

    if (region) {
      qb.andWhere('resource.region = :region', { region });
    }

    if (domain) {
      qb.andWhere(':domain = ANY(resource.domains)', { domain });
    }

    if (search) {
      qb.andWhere(
        '(resource.name ILIKE :search OR resource.description ILIKE :search OR resource.address ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isVerified !== undefined) {
      qb.andWhere('resource.isVerified = :isVerified', { isVerified });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<RecoveryResource> {
    const resource = await this.resourceRepository.findOne({
      where: { id },
      relations: ['tags'],
    });

    if (!resource) {
      throw new NotFoundException(`Recovery resource #${id} not found`);
    }

    return resource;
  }

  async findByCity(city: string): Promise<RecoveryResource[]> {
    return this.resourceRepository.find({
      where: { city, isActive: true },
      relations: ['tags'],
      order: { name: 'ASC' },
    });
  }

  async getCities(): Promise<string[]> {
    const result = await this.resourceRepository
      .createQueryBuilder('resource')
      .select('DISTINCT resource.city', 'city')
      .where('resource.city IS NOT NULL')
      .andWhere('resource.isActive = true')
      .orderBy('resource.city', 'ASC')
      .getRawMany();

    return result.map((r) => r.city);
  }

  async update(
    id: number,
    updateDto: UpdateRecoveryResourceDto,
  ): Promise<RecoveryResource> {
    const resource = await this.findOne(id);
    const { tagIds, ...updateData } = updateDto;

    Object.assign(resource, updateData);

    if (tagIds !== undefined) {
      resource.tags =
        tagIds.length > 0
          ? await this.tagRepository.findBy({ id: In(tagIds) })
          : [];
    }

    return this.resourceRepository.save(resource);
  }

  async remove(id: number): Promise<void> {
    const result = await this.resourceRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Recovery resource #${id} not found`);
    }
  }

  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byCity: Record<string, number>;
  }> {
    const total = await this.resourceRepository.count({
      where: { isActive: true },
    });

    const byTypeRaw = await this.resourceRepository
      .createQueryBuilder('resource')
      .select('resource.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('resource.isActive = true')
      .groupBy('resource.type')
      .getRawMany();

    const byType = byTypeRaw.reduce(
      (acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const byCityRaw = await this.resourceRepository
      .createQueryBuilder('resource')
      .select('resource.city', 'city')
      .addSelect('COUNT(*)', 'count')
      .where('resource.isActive = true')
      .andWhere('resource.city IS NOT NULL')
      .groupBy('resource.city')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const byCity = byCityRaw.reduce(
      (acc, item) => {
        acc[item.city] = parseInt(item.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    return { total, byType, byCity };
  }
}