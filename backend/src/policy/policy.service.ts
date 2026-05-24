import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Document } from './entities/document.entity';
import { AssessmentCell } from './entities/assessment-cell.entity';
import { Tag } from '../tags/entities/tag.entity';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
  CreateAssessmentCellDto,
  UpdateAssessmentCellDto,
  BulkAssessmentCellDto,
} from './dto/policy.dto';
import { DomainCode, PolicyAxis } from '../common/enums';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(AssessmentCell)
    private cellRepository: Repository<AssessmentCell>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  async createDocument(createDto: CreateDocumentDto): Promise<Document> {
    const { tagIds, ...documentData } = createDto;
    const document = this.documentRepository.create(documentData);

    if (tagIds && tagIds.length > 0) {
      document.tags = await this.tagRepository.findBy({ id: In(tagIds) });
    }

    return this.documentRepository.save(document);
  }

  async findAllDocuments(
    query: DocumentQueryDto,
  ): Promise<{ data: Document[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, country, region, year, search } = query;

    const qb = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.tags', 'tags')
      .orderBy('document.createdAt', 'DESC');

    if (country) {
      qb.andWhere('document.country = :country', { country });
    }

    if (region) {
      qb.andWhere('document.region = :region', { region });
    }

    if (year) {
      qb.andWhere('document.year = :year', { year });
    }

    if (search) {
      qb.andWhere(
        '(document.title ILIKE :search OR document.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneDocument(id: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['tags', 'assessmentCells'],
    });

    if (!document) {
      throw new NotFoundException(`Document #${id} not found`);
    }

    await this.documentRepository.increment({ id }, 'viewCount', 1);
    return document;
  }

  async findOneDocumentWithoutView(id: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['tags', 'assessmentCells'],
    });
    if (!document) {
      throw new NotFoundException(`Document #${id} not found`);
    }
    return document;
  }

  async updateDocument(
    id: number,
    updateDto: UpdateDocumentDto,
  ): Promise<Document> {
    const document = await this.findOneDocument(id);
    const { tagIds, ...updateData } = updateDto;

    Object.assign(document, updateData);

    if (tagIds !== undefined) {
      document.tags =
        tagIds.length > 0
          ? await this.tagRepository.findBy({ id: In(tagIds) })
          : [];
    }

    return this.documentRepository.save(document);
  }

  async removeDocument(id: number): Promise<void> {
    const result = await this.documentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Document #${id} not found`);
    }
  }

  async getMatrix(
    documentId: number,
  ): Promise<{ document: Document; matrix: Record<string, Record<string, AssessmentCell>> }> {
    const document = await this.findOneDocument(documentId);
    const cells = await this.cellRepository.find({
      where: { documentId },
    });

    const matrix: Record<string, Record<string, AssessmentCell>> = {};

    for (const domain of Object.values(DomainCode)) {
      matrix[domain] = {};
      for (const axis of Object.values(PolicyAxis)) {
        const cell = cells.find(
          (c) => c.domain === domain && c.policyAxis === axis,
        );
        if (cell) {
          matrix[domain][axis] = cell;
        }
      }
    }

    return { document, matrix };
  }

  async createCell(createDto: CreateAssessmentCellDto): Promise<AssessmentCell> {
    await this.findOneDocument(createDto.documentId);
    const cell = this.cellRepository.create(createDto);
    return this.cellRepository.save(cell);
  }

  async updateCell(
    id: number,
    updateDto: UpdateAssessmentCellDto,
  ): Promise<AssessmentCell> {
    const cell = await this.cellRepository.findOne({ where: { id } });

    if (!cell) {
      throw new NotFoundException(`Assessment cell #${id} not found`);
    }

    Object.assign(cell, updateDto);
    return this.cellRepository.save(cell);
  }

  async bulkUpdateCells(bulkDto: BulkAssessmentCellDto): Promise<AssessmentCell[]> {
    const { documentId, cells } = bulkDto;
    await this.findOneDocument(documentId);

    const results: AssessmentCell[] = [];

    for (const cellData of cells) {
      let cell = await this.cellRepository.findOne({
        where: {
          documentId,
          domain: cellData.domain,
          policyAxis: cellData.policyAxis,
        },
      });

      if (cell) {
        cell.label = cellData.label;
        cell.note = cellData.note || cell.note;
      } else {
        cell = this.cellRepository.create({
          documentId,
          ...cellData,
        });
      }

      results.push(await this.cellRepository.save(cell));
    }

    return results;
  }

  async deleteCell(id: number): Promise<void> {
    const result = await this.cellRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Assessment cell #${id} not found`);
    }
  }

  async getDocumentStats(): Promise<{
    total: number;
    byCountry: Record<string, number>;
    byYear: Record<number, number>;
  }> {
    const total = await this.documentRepository.count();

    const byCountryRaw = await this.documentRepository
      .createQueryBuilder('document')
      .select('document.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .groupBy('document.country')
      .getRawMany();

    const byCountry = byCountryRaw.reduce(
      (acc, item) => {
        acc[item.country] = parseInt(item.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const byYearRaw = await this.documentRepository
      .createQueryBuilder('document')
      .select('document.year', 'year')
      .addSelect('COUNT(*)', 'count')
      .where('document.year IS NOT NULL')
      .groupBy('document.year')
      .orderBy('document.year', 'DESC')
      .getRawMany();

    const byYear = byYearRaw.reduce(
      (acc, item) => {
        acc[item.year] = parseInt(item.count);
        return acc;
      },
      {} as Record<number, number>,
    );

    return { total, byCountry, byYear };
  }
}