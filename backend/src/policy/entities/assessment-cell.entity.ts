import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { DomainCode, PolicyAxis, AssessmentLabel } from '../../common/enums';
import { Document } from './document.entity';

@Entity('assessment_cells')
@Unique(['document', 'domain', 'policyAxis'])
export class AssessmentCell {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'document_id' })
  documentId: number;

  @ManyToOne(() => Document, (document) => document.assessmentCells, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ type: 'varchar', length: 5 })
  domain: DomainCode;

  @Column({ name: 'policy_axis', type: 'varchar', length: 5 })
  policyAxis: PolicyAxis;

  @Column({ type: 'varchar', length: 20 })
  label: AssessmentLabel;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}