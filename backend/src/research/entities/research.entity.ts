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
