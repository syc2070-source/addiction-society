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
      const key = `${dto.title.trim().toLowerCase()}|${dto.year ?? ''}`;
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      try {
        await this.researchService.create(dto);
        existing.add(key);
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
      .addSelect('r.year', 'year')
      .getRawMany();
    return new Set(
      rows.map((x: { title: string; year: number | null }) =>
        `${x.title.trim().toLowerCase()}|${x.year ?? ''}`,
      ),
    );
  }

  private normalizeAuthors(authors: unknown): string[] | undefined {
    if (authors == null) return undefined;
    if (typeof authors === 'string') {
      const s = authors.trim();
      return s ? [s] : undefined;
    }
    if (!Array.isArray(authors)) return undefined;
    const out: string[] = [];
    for (const a of authors) {
      if (typeof a === 'string') {
        const s = a.trim();
        if (s) out.push(s);
      } else if (a && typeof a === 'object') {
        const name = (a as { name?: unknown }).name;
        if (typeof name === 'string' && name.trim()) {
          out.push(name.trim());
        } else {
          out.push(String(a));
        }
      } else if (a != null) {
        out.push(String(a));
      }
    }
    return out.length > 0 ? out : undefined;
  }

  private mapDocumentItemToDto(
    item: Record<string, unknown>,
    query: string,
  ): CreateResearchDto {
    const title = typeof item.title === 'string' ? item.title : '';
    const url = typeof item.url === 'string' ? item.url : undefined;
    const doi = typeof item.doi === 'string' ? item.doi : undefined;
    let sourceUrl = url;
    if (!sourceUrl && doi) {
      sourceUrl = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
    }
    const pubYear = item.pub_year;
    const year =
      typeof pubYear === 'number'
        ? pubYear
        : pubYear != null && !Number.isNaN(Number(pubYear))
          ? Number(pubYear)
          : undefined;

    return {
      title,
      abstract:
        typeof item.abstract_text === 'string' ? item.abstract_text : undefined,
      year,
      sourceUrl,
      source:
        typeof item.collect_method === 'string' ? item.collect_method : undefined,
      authors: this.normalizeAuthors(item.authors),
      keywords: query ? [query] : undefined,
    };
  }

  private async loadCandidates(): Promise<CreateResearchDto[]> {
    const statoryBase = this.config.get<string>('STATORY_API_URL')?.trim();
    if (statoryBase) {
      try {
        const query =
          this.config.get<string>('STATORY_ACADEMIC_QUERY')?.trim() ?? '';
        const limitRaw = this.config.get<string>('STATORY_ACADEMIC_LIMIT');
        const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : 10;
        const limit = Number.isFinite(parsedLimit) ? parsedLimit : 10;
        const base = statoryBase.replace(/\/+$/, '');
        const res = await fetch(`${base}/api/search/academic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          success?: boolean;
          items?: unknown[];
          error?: string;
        };
        if (json.success === false) {
          this.logger.warn(
            `Statory academic search 실패: ${json.error ?? 'unknown'}`,
          );
          return [];
        }
        const items = Array.isArray(json.items) ? json.items : [];
        const mapped: CreateResearchDto[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const dto = this.mapDocumentItemToDto(
            item as Record<string, unknown>,
            query,
          );
          if (dto.title?.trim()) mapped.push(dto);
        }
        return mapped;
      } catch (e) {
        this.logger.warn(`STATORY_API_URL 로드 실패: ${e}`);
        return [];
      }
    }

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
