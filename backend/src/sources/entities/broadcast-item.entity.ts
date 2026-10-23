import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * 연대기 「방송」 줄 (SOC-R1 ■7).
 *
 * 중독뉴스 공개 API(GET /articles/latest?kind=broadcast, 열쇠 없음)를 매일 예약이
 * 하루 한 번 읽어 넣는다. 링크(url) 유일 → 같은 방송을 두 번 넣지 않는다.
 * 넣기만 한다(덮어쓰기·지우기 없음). SOC-R12: 중독뉴스 목록에서 빠진 편은 hidden_reason 으로
 * 연대기 공개에서만 내린다(행은 남음) · source_en 은 비었거나 정본과 다를 때만 맞춘다.
 */
@Entity('broadcast_items')
@Index('IDX_broadcast_items_published_at', ['publishedAt'])
export class BroadcastItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', unique: true })
  url: string;

  @Column({ type: 'text' })
  title: string;

  /** 방송사(중독뉴스 응답의 source). */
  @Column({ type: 'text', nullable: true })
  broadcaster: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /** 출처 등급 — 이 줄은 늘 '방송'. */
  @Column({ type: 'text', default: '방송' })
  grade: string;

  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'now()' })
  fetchedAt: Date;

  /** 방송 영어 이름(SOC-R12 ■2) — 중독뉴스 sourceEn → 정본 표(program_en). */
  @Column({ name: 'source_en', type: 'text', nullable: true })
  sourceEn: string | null;

  /**
   * 연대기 공개에서 내린 까닭(SOC-R12 ■1) — 'source_archived' = 중독뉴스 방송 목록에서 빠짐.
   * NULL = 보임. 행은 지우지 않는다 · 다시 실리면 NULL 로 돌아간다.
   */
  @Column({ name: 'hidden_reason', type: 'text', nullable: true })
  hiddenReason: string | null;

  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;
}
