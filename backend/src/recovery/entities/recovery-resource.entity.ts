import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { DomainCode, RegionCode, ResourceType } from '../../common/enums';
import { Tag } from '../../tags/entities/tag.entity';

@Entity('recovery_resources')
export class RecoveryResource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 300 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: ResourceType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 10, default: RegionCode.KR })
  region: RegionCode;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 500, nullable: true })
  website: string;

  @Column({ name: 'operating_hours', length: 200, nullable: true })
  operatingHours: string;

  @Column('varchar', { array: true, nullable: true })
  domains: DomainCode[];

  /** 출처 URL — 공공 목록 크롤링 자원의 원본 페이지 (AS-FILL-1) */
  @Column({ name: 'source_url', type: 'varchar', length: 500, nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'recovery_resource_tags',
    joinColumn: { name: 'resource_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];
}