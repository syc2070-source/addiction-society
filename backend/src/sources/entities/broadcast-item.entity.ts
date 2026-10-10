import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * 연대기 「방송」 줄 (SOC-R1 ■7).
 *
 * 중독뉴스 공개 API(GET /articles/latest?kind=broadcast, 열쇠 없음)를 매일 예약이
 * 하루 한 번 읽어 넣는다. 링크(url) 유일 → 같은 방송을 두 번 넣지 않는다.
 * 넣기만 한다(덮어쓰기·지우기 없음).
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
}
