import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { RegionCode } from '../../common/enums';
import { Tag } from '../../tags/entities/tag.entity';
import { AssessmentCell } from './assessment-cell.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  title: string;

  @Column({ length: 100 })
  country: string;

  @Column({ nullable: true })
  year: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ name: 'pdf_url', length: 500, nullable: true })
  pdfUrl: string;

  @Column({ name: 'source_url', length: 500, nullable: true })
  sourceUrl: string;

  @Column({ length: 200, nullable: true })
  source: string;

  /**
   * sources 레지스트리 연계 키(nullable FK → sources.id). 수기 문서는 null.
   * 소스 대표 산출물로 시드된 문서는 해당 소스 id를 가진다.
   */
  @Column({ name: 'source_id', type: 'text', nullable: true })
  sourceId: string | null;

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
    name: 'document_tags',
    joinColumn: { name: 'document_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @OneToMany(() => AssessmentCell, (cell) => cell.document)
  assessmentCells: AssessmentCell[];
}
