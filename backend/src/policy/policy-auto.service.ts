import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { PolicyService } from './policy.service';
import { CreateDocumentDto } from './dto/policy.dto';

const DEFAULT_POLICY_SEED: CreateDocumentDto[] = [
  {
    title: '[자동수집] OECD 건강통계 중독·알코올 지표 스냅샷',
    country: 'OECD',
    year: 2024,
    summary:
      '회원국 알코올 소비·사망·정책 지표를 요약한 공개 보고서 기반 데모 레코드.',
    sourceUrl: 'https://www.oecd.org',
  },
  {
    title: '[자동수집] 유럽 디지털 서비스법(DSA) 중독성 디자인 조항 메모',
    country: 'EU',
    year: 2023,
    summary: '플랫폼 투명성·위험 평가와 관련된 조항을 정리한 내부 큐레이션(데모).',
  },
];

@Injectable()
export class PolicyAutoService {
  private readonly logger = new Logger(PolicyAutoService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly policyService: PolicyService,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async runOnce(): Promise<{ inserted: number; skipped: number; source: string }> {
    const existing = await this.existingTitles();
    const candidates = await this.loadCandidates();
    let inserted = 0;
    let skipped = 0;
    const source =
      this.config.get<string>('AUTO_COLLECT_POLICY_URL')?.trim() || 'default_seed';

    for (const dto of candidates) {
      if (!dto?.title?.trim() || !dto?.country?.trim()) continue;
      if (existing.has(dto.title)) {
        skipped++;
        continue;
      }
      try {
        await this.policyService.createDocument(dto);
        existing.add(dto.title);
        inserted++;
      } catch (e) {
        this.logger.warn(`정책 자동수집 스킵: ${dto.title} — ${e}`);
      }
    }

    return { inserted, skipped, source };
  }

  private async existingTitles(): Promise<Set<string>> {
    const rows = await this.documentRepository
      .createQueryBuilder('d')
      .select('d.title', 'title')
      .getRawMany();
    return new Set(rows.map((x: { title: string }) => x.title));
  }

  private async loadCandidates(): Promise<CreateDocumentDto[]> {
    const url = this.config.get<string>('AUTO_COLLECT_POLICY_URL')?.trim();
    if (url) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const arr = Array.isArray(json)
          ? json
          : json.items ?? json.data ?? json.documents ?? [];
        if (Array.isArray(arr) && arr.length > 0) {
          return arr as CreateDocumentDto[];
        }
      } catch (e) {
        this.logger.warn(`AUTO_COLLECT_POLICY_URL 로드 실패, 기본 시드 사용: ${e}`);
      }
    }
    return DEFAULT_POLICY_SEED;
  }
}
