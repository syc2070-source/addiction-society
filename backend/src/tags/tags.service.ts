import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { TagType } from '../common/enums';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  async findAll(): Promise<Tag[]> {
    return this.tagRepository.find({
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  async findByType(type: TagType): Promise<Tag[]> {
    return this.tagRepository.find({
      where: { type },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { id } });

    if (!tag) {
      throw new NotFoundException(`Tag #${id} not found`);
    }

    return tag;
  }

  async findByName(name: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { name } });
  }

  async create(data: { name: string; type: TagType; description?: string }): Promise<Tag> {
    const tag = this.tagRepository.create(data);
    return this.tagRepository.save(tag);
  }

  async update(
    id: number,
    data: { name?: string; description?: string },
  ): Promise<Tag> {
    const tag = await this.findOne(id);
    Object.assign(tag, data);
    return this.tagRepository.save(tag);
  }

  async remove(id: number): Promise<void> {
    const result = await this.tagRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tag #${id} not found`);
    }
  }

  async getGroupedTags(): Promise<Record<TagType, Tag[]>> {
    const tags = await this.findAll();

    return tags.reduce(
      (acc, tag) => {
        if (!acc[tag.type]) {
          acc[tag.type] = [];
        }
        acc[tag.type].push(tag);
        return acc;
      },
      {} as Record<TagType, Tag[]>,
    );
  }
}