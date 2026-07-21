import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * 중독 데이터 관측소 - 데이터 소스 레지스트리
 * 국제/미국/한국 기관의 정기 발간물을 추적하기 위한 메타데이터 테이블.
 * id는 사람이 읽을 수 있는 문자열 키('who_gho_alcohol' 등)를 직접 지정한다.
 *
 * 주의: 속성명은 camelCase, 실제 DB 컬럼은 snake_case(@Column name)로 매핑한다.
 * jsonb(accessDetail), int[](expectedMonth)는 이 코드베이스 최초 사용이지만
 * pg 드라이버 + TypeORM + synchronize 조합에서 정상 생성된다.
 */
@Entity('sources')
export class Source {
  /** 문자열 기본키 (예: 'unodc_wdr') */
  @PrimaryColumn('text')
  id: string;

  /** 발간 기관 영문/약칭 (예: 'WHO') */
  @Column('text')
  org: string;

  /** 발간 기관 한글명 */
  @Column({ type: 'text', name: 'org_ko' })
  orgKo: string;

  /** 중독 도메인: alcohol|drug|gambling|digital|tobacco|policy|multi */
  @Column('text')
  domain: string;

  /** 지리적 범위: global|regional|korea */
  @Column('text')
  scope: string;

  /** 자료 성격: prevalence|policy|treatment|market|enforcement */
  @Column('text')
  kind: string;

  /** 자료 한글 제목 */
  @Column({ type: 'text', name: 'title_ko' })
  titleKo: string;

  /** 자료 영문 제목 */
  @Column({ type: 'text', name: 'title_en' })
  titleEn: string;

  /** 원본 URL */
  @Column('text')
  url: string;

  /** 수집 방식: api|csv|pdf|html|manual */
  @Column({ type: 'text', name: 'access_method' })
  accessMethod: string;

  /** 수집 상세(형식/파서/비고 등 자유 구조) - jsonb */
  @Column({ type: 'jsonb', name: 'access_detail', nullable: true })
  accessDetail: Record<string, any> | null;

  /** 발간 주기: monthly|quarterly|annual|biennial|quinquennial|irregular */
  @Column('text')
  cadence: string;

  /** 통상 발간 월(1~12) 배열 - int[] */
  @Column('int', { array: true, nullable: true, name: 'expected_month' })
  expectedMonth: number[] | null;

  /** 마지막으로 생존 확인한 시각 */
  @Column({ type: 'timestamptz', name: 'last_checked_at', nullable: true })
  lastCheckedAt: Date | null;

  /** 마지막 실제 발간일 */
  @Column({ type: 'date', name: 'last_published_at', nullable: true })
  lastPublishedAt: string | null;

  /** 다음 예상 발간일 (M1에서는 전부 null, M2에서 계산) */
  @Column({ type: 'date', name: 'next_expected_at', nullable: true })
  nextExpectedAt: string | null;

  /** 소스 상태: active|stale|dead */
  @Column({ type: 'text', default: 'active' })
  status: string;

  /** 라이선스(예: CC BY-NC-SA 3.0 IGO) */
  @Column({ type: 'text', nullable: true })
  license: string | null;

  /** 신뢰도: 1(1차 소스) 2(기관 2차) 3(언론) */
  @Column({ type: 'int', nullable: true })
  reliability: number | null;

  /** HTTP ETag(변경 감지용) */
  @Column({ type: 'text', nullable: true })
  etag: string | null;

  /** HTTP Last-Modified 헤더(변경 감지 2순위) */
  @Column({ type: 'text', name: 'last_modified', nullable: true })
  lastModified: string | null;

  /** 본문 해시(변경 감지용) */
  @Column({ type: 'text', name: 'content_hash', nullable: true })
  contentHash: string | null;

  /** 연속 실패 횟수(3회 연속이면 stale). 성공 시 0으로 리셋 */
  @Column({ type: 'int', name: 'fail_count', default: 0 })
  failCount: number;

  /** 마지막 알림 전송 시각. 쿨다운 기준(change 7일 / manual 30일) */
  @Column({ type: 'timestamptz', name: 'last_notified_at', nullable: true })
  lastNotifiedAt: Date | null;

  /** 운영 메모 */
  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
