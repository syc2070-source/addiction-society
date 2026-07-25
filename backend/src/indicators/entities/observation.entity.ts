import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Indicator } from './indicator.entity';

/**
 * 관측치(observation) — 지표의 실제 값 하나. 시계열의 한 점.
 * "숫자는 얼마인가 + 어디서 왔나"에 답한다.
 *
 * ▸ append-only(덮어쓰기 금지) 설계.
 *   유니크 키에 fetched_at을 포함해, 같은 (지표·소스·지역·기간)이라도 수집 시점이 다르면
 *   새 행으로 보존한다. WHO/EUDA는 과거 연도 수치를 재추정(개정)하는데, 덮어쓰면
 *   "그 시점에 우리가 보여준 값"의 감사추적이 사라진다. 이는 원칙3(원본 딥링크)·정관 2조
 *   (검수 신뢰)와 충돌한다. 표시 시에는 (지표·지역·기간)별 최신 fetched_at 행을 고르고,
 *   개정 이력은 그대로 남긴다 — "값이 언제 바뀌었나"까지 보여주는 것이 관측소의 자산.
 *
 * 블루프린트 원칙3: 모든 수치에 원본 딥링크 → source_url NOT NULL.
 *
 * ⚠️ AS-M3-0(설계) 단계: 등록만. 테이블 생성은 M3-1 마이그레이션에서.
 */
@Entity('observations')
@Index(
  'IDX_obs_series_unique',
  ['indicatorId', 'sourceId', 'geo', 'period', 'fetchedAt'],
  {
    unique: true,
  },
)
@Index('IDX_obs_indicator_geo_period', ['indicatorId', 'geo', 'period'])
export class Observation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indicator_id' })
  indicatorId: number;

  @ManyToOne(() => Indicator, (ind) => ind.observations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'indicator_id' })
  indicator: Indicator;

  /** 실측 출처(sources.id). 지표 기본 소스와 다를 수 있어 별도 보관. FK는 마이그레이션에서. */
  @Column({ name: 'source_id', type: 'text', nullable: true })
  sourceId: string | null;

  /** 지역 단위. ISO3(예: 'KOR','DEU') 또는 국내 'KR'/시도코드. */
  @Column({ length: 20 })
  geo: string;

  /** 기간. 'YYYY' | 'YYYY-Qn' | 'YYYY-MM' 등 문자열로 통일(연·분기·월 혼재 대응). */
  @Column({ length: 20 })
  period: string;

  /** 값. pg numeric은 드라이버에서 string으로 매핑된다(정밀도 보존). */
  @Column({ type: 'numeric' })
  value: string;

  /** 신뢰구간 하한(95% CI 등). 없으면 null. */
  @Column({ name: 'value_low', type: 'numeric', nullable: true })
  valueLow: string | null;

  /** 신뢰구간 상한. 없으면 null. */
  @Column({ name: 'value_high', type: 'numeric', nullable: true })
  valueHigh: string | null;

  /** 부가 한정어(예: 'sex=MLE', 'beverage=beer', 'provisional'). 차원/잠정 표시. */
  @Column({ length: 100, nullable: true })
  qualifier: string | null;

  /** 수집 시각. append-only 시계열 보존 키의 일부. */
  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'now()' })
  fetchedAt: Date;

  /** 원본 딥링크(원칙3 — NOT NULL). 해당 값의 근거 페이지/파일 URL. */
  @Column({ name: 'source_url', length: 500 })
  sourceUrl: string;
}
