import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * ECO-LINK1 받는 표 (SOC-R15 ■4 · 계약 v1.4 §6-3) — Statory 카드 · 중독뉴스 기사.
 * 받는 문(import:eco)이 넣고, 관리자 검수(PUT /api/admin/eco/:id/review)가 결정을 쓴다.
 * 행은 지우지 않는다 — 원천에서 빠지면 upstream='withdrawn'.
 */
@Entity('eco_inbox')
@Unique('UQ_eco_inbox_origin_slug_version', ['origin', 'slug', 'version'])
@Index('IDX_eco_inbox_paper_key', ['origin', 'paperKey'])
export class EcoInboxItem {
  @PrimaryGeneratedColumn()
  id: number;

  /** 'statory' | 'addicted-news' */
  @Column({ type: 'text' })
  origin: string;

  /** `statory:card:<card_id>` · `addicted-news:<kind>:<id>`(계약 §4) */
  @Column({ type: 'text' })
  slug: string;

  /** Statory card_version · 중독뉴스 '' */
  @Column({ type: 'text', default: '' })
  version: string;

  /** 결정 상속 열쇠(`paper:` · `card:` · 중독뉴스 = slug) */
  @Column({ name: 'paper_key', type: 'text' })
  paperKey: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  /** paper · broadcast · article(계약 §2) */
  @Column({ type: 'text' })
  grade: string;

  /** card · broadcast · article */
  @Column({ type: 'text' })
  kind: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  subtype: string[];

  @Column({ type: 'text', nullable: true })
  topic: string | null;

  @Column({ type: 'text', nullable: true })
  licence: string | null;

  @Column({ name: 'licence_use', type: 'text', nullable: true })
  licenceUse: string | null;

  @Column({ type: 'jsonb', nullable: true })
  missing: string[] | null;

  /** 받은 줄(아는 열쇠만) */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    name: 'source_generated_at',
    type: 'timestamptz',
    nullable: true,
  })
  sourceGeneratedAt: Date | null;

  /** public · withdrawn(§3-3) */
  @Column({ type: 'text', default: 'public' })
  upstream: string;

  @Column({ name: 'review_decision', type: 'text', nullable: true })
  reviewDecision: 'keep' | 'hide' | null;

  @Column({ name: 'reviewed_by', type: 'text', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'keep_from_version', type: 'text', nullable: true })
  keepFromVersion: string | null;

  @Column({ name: 'key_moved_from', type: 'text', nullable: true })
  keyMovedFrom: string | null;

  @Column({ name: 'key_moved_at', type: 'timestamptz', nullable: true })
  keyMovedAt: Date | null;

  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'now()' })
  fetchedAt: Date;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastSeenAt: Date;
}
