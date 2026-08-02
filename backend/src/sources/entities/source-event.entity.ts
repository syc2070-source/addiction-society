import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * 소스 감지·감시 이력 (AS-M3-LEDGER, 블루프린트 원칙11).
 *
 * 크론(sources.scheduler)이 소스를 확인할 때마다 1행 append 한다(덮어쓰기 금지).
 * source 레코드의 필드 갱신(현재 상태)은 그대로 두되, "변화의 순간"을 이벤트로 남겨
 * "언제 무엇이 어떻게 바뀌었나"를 보존한다. Discord 알림은 이 이벤트의 표현일 뿐
 * (알림이 휘발해도 이벤트는 남는다 → notified 플래그로 알림 발생 여부만 기록).
 *
 * append-only: 유니크 키 없음. 매 확인이 새 행. 절대 UPDATE/DELETE 하지 않는다.
 *
 * ⚠️ nullable 컬럼은 반드시 type 명시(TS 유니언 string|null은 design:type이 Object로
 *    반사되어 명시 없으면 postgres 매핑 실패 — AS-M3-1b 교훈).
 */
@Entity('source_events')
@Index('IDX_source_events_detected_at', ['detectedAt'])
@Index('IDX_source_events_source_id', ['sourceId'])
export class SourceEvent {
  @PrimaryGeneratedColumn()
  id: number;

  /** 대상 소스(sources.id). FK는 마이그레이션에서 부여. */
  @Column({ name: 'source_id', type: 'text' })
  sourceId: string;

  /**
   * 이벤트 종류:
   *  published(새 발간 감지) | changed(내용 변경 감지) | checked(확인, 변화 없음) |
   *  failed(요청 실패) | stale(연속 실패로 정지) | manual(수동 확인 요망) |
   *  blocked(봇 차단) | rescheduled(예정 월 경과 → 다음 주기로 이월, 발간 미확인)
   */
  @Column({ name: 'event_type', type: 'varchar', length: 20 })
  eventType: string;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'now()' })
  detectedAt: Date;

  /** 변경 전 검증자(content_hash/etag/last-modified 중 해당). 없으면 null. */
  @Column({ name: 'prev_hash', type: 'text', nullable: true })
  prevHash: string | null;

  /** 변경 후 검증자. 없으면 null. */
  @Column({ name: 'new_hash', type: 'text', nullable: true })
  newHash: string | null;

  /** 변경 전 발간일. */
  @Column({ name: 'prev_published_at', type: 'date', nullable: true })
  prevPublishedAt: string | null;

  /** 변경 후 발간일(발간 감지 시). */
  @Column({ name: 'new_published_at', type: 'date', nullable: true })
  newPublishedAt: string | null;

  /** 감지 근거(감지 방법·실패 메시지·쿨다운 여부·failCount 등 자유 구조). */
  @Column({ type: 'jsonb', nullable: true })
  detail: Record<string, unknown> | null;

  /** 이 이벤트로 Discord 알림이 실제 전송됐는가. */
  @Column({ type: 'boolean', default: false })
  notified: boolean;
}
