import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Research } from './entities/research.entity';
import { ResearchService } from './research.service';
import { CreateResearchDto } from './dto/research.dto';
import { RegionCode } from '../common/enums';

const DEFAULT_RESEARCH_SEED: CreateResearchDto[] = [
  {
    title: '[자동수집] WHO 알코올 정책 브리프 요약',
    authors: ['WHO'],
    year: 2024,
    abstract:
      '국가별 알코올 유통·세금·광고 규제 현황을 정리한 공개 브리프 기반 요약(데모).',
    summary: '예방·규제·치료 접근성 지표 중심 개관.',
    region: RegionCode.KR,
    keywords: ['알코올', '정책', 'WHO'],
    sourceUrl: 'https://www.who.int',
  },
  {
    title: '[자동수집] 디지털 미디어 사용과 정신건강 메타분석 후속',
    authors: ['AutoFeed'],
    year: 2025,
    abstract:
      '청소년 스크린타임과 우울·불안 상관에 대한 후속 분석 노트(데모).',
    summary: '역인과 혼란변수 논의 및 정책 시사점.',
    region: RegionCode.US,
    keywords: ['스크린타임', '청소년', '정신건강'],
  },
];

@Injectable()
export class ResearchAutoService {
  private readonly logger = new Logger(ResearchAutoService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly researchService: ResearchService,
    @InjectRepository(Research)
    private readonly researchRepository: Repository<Research>,
  ) {}

  async runOnce(): Promise<{ inserted: number; skipped: number; source: string }> {
    const existing = await this.existingTitles();
    const candidates = await this.loadCandidates();
    let inserted = 0;
    let skipped = 0;
    const source =
      this.config.get<string>('AUTO_COLLECT_RESEARCH_URL')?.trim() || 'default_seed';

    for (const dto of candidates) {
      if (!dto?.title?.trim()) continue;
      if (existing.has(dto.title)) {
        skipped++;
        continue;
      }
      try {
        await this.researchService.create(dto);
        existing.add(dto.title);
        inserted++;
      } catch (e) {
        this.logger.warn(`연구 자동수집 스킵: ${dto.title} — ${e}`);
      }
    }

    return { inserted, skipped, source };
  }

  private async existingTitles(): Promise<Set<string>> {
    const rows = await this.researchRepository
      .createQueryBuilder('r')
      .select('r.title', 'title')
      .getRawMany();
    return new Set(rows.map((x: { title: string }) => x.title));
  }

  private async loadCandidates(): Promise<CreateResearchDto[]> {
    const url = this.config.get<string>('AUTO_COLLECT_RESEARCH_URL')?.trim();
    if (url) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const arr = Array.isArray(json)
          ? json
          : json.items ?? json.data ?? json.research ?? [];
        if (Array.isArray(arr) && arr.length > 0) {
          return arr as CreateResearchDto[];
        }
      } catch (e) {
        this.logger.warn(`AUTO_COLLECT_RESEARCH_URL 로드 실패, 기본 시드 사용: ${e}`);
      }
    }
    return DEFAULT_RESEARCH_SEED;
  }
}
