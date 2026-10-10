import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { DomainCode, RegionCode } from '../../common/enums';
import { Tag } from '../../tags/entities/tag.entity';

@Entity('research')
export class Research {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  title: string;

  @Column('text', { array: true, nullable: true })
  authors: string[];

  @Column({ nullable: true })
  year: number;

  @Column({ type: 'text', nullable: true })
  abstract: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column('text', { array: true, nullable: true })
  keywords: string[];

  @Column('varchar', { array: true, nullable: true })
  domains: DomainCode[];

  @Column({ name: 'pdf_url', length: 500, nullable: true })
  pdfUrl: string;

  @Column({ name: 'source_url', length: 500, nullable: true })
  sourceUrl: string;

  @Column({ length: 200, nullable: true })
  source: string;

  /**
   * 공개 검토 상태. 'approved'만 공개 페이지에 노출(원칙 8).
   * collect:research 자동수집분은 'pending'으로 삽입되어 검토(SQL 승인) 전까지 비공개.
   */
  @Column({ type: 'varchar', length: 20, default: 'approved' })
  status: string;

  /** 검수 창(SOC-R1): 관문에 걸린 승인분을 살린(keep)/숨긴(hide) 사람·시각. */
  @Column({ name: 'reviewed_by', type: 'text', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_decision', type: 'text', nullable: true })
  reviewDecision: 'keep' | 'hide' | null;

  /** 관련성 관문 판정 기록(SOC-R1). 판정 자체는 늘 relevance.ts 가 다시 한다. */
  @Column({ name: 'relevance_score', type: 'numeric', nullable: true })
  relevanceScore: string | null;

  @Column({ name: 'relevance_reason', type: 'text', nullable: true })
  relevanceReason: string | null;

  @Column({ name: 'relevance_checked_at', type: 'timestamptz', nullable: true })
  relevanceCheckedAt: Date | null;

  @Column({ type: 'varchar', length: 10, default: RegionCode.KR })
  region: RegionCode;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'research_tags',
    joinColumn: { name: 'research_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];
}
