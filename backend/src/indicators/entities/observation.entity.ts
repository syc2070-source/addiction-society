import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Indicator } from './indicator.entity';

/** 관측치 개정 이력 1건(revisions jsonb 배열 원소). 값이 바뀔 때 이전 값을 보존한다. */
export interface ObservationRevision {
  value: string;
  valueLow: string | null;
  valueHigh: string | null;
  qualifier: string | null;
  sourceUrl: string;
  fetchedAt: string; // ISO
}

/**
 * 관측치(observation) — 지표의 실제 값 하나. 시계열의 한 점.
 * "숫자는 얼마인가 + 어디서 왔나"에 답한다.
 *
 * ▸ 재수집 정책: **upsert + revisions 감사**(M3-1 확정).
 *   유니크 키 = (indicator_id, source_id, geo, period) — fetched_at 제외.
 *   같은 (지표·소스·지역·기간)을 재수집해도 새 행을 만들지 않고 **한 행을 갱신**(중복 방지).
 *   값이 바뀌면 이전 값을 revisions(jsonb 배열)에 누적하고 현재 값·fetched_at을 갱신한다.
 *   값이 같으면 fetched_at만 갱신(생존 확인).
 *
 *   근거(단순 upsert 대신 revisions 채택): WHO/EUDA/KCGP는 과거 연도 수치를 재추정(개정)한다.
 *   덮어쓰기만 하면 "그 시점에 게시한 값"의 감사추적이 사라져 원칙3(원본 딥링크)·정관2조
 *   (검수 신뢰)와 충돌한다. fetched_at을 키에서 빼 중복 행은 막되, revisions로 개정 이력을
 *   한 행 안에 보존한다 — 시계열은 (지표·지역·기간)당 한 행, 감사추적은 revisions에.
 *
 * 블루프린트 원칙3: 모든 수치에 원본 딥링크 → source_url NOT NULL.
 */
@Entity('observations')
@Index('IDX_obs_series_unique', ['indicatorId', 'sourceId', 'geo', 'period'], {
  unique: true,
})
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

  /** 개정 이력(감사추적). 값이 바뀔 때 이전 값을 push. 없으면 null. */
  @Column({ type: 'jsonb', nullable: true })
  revisions: ObservationRevision[] | null;

  /** 마지막 수집 시각(값 확인/갱신 시각). */
  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'now()' })
  fetchedAt: Date;

  /** 원본 딥링크(원칙3 — NOT NULL). 해당 값의 근거 페이지/파일 URL. */
  @Column({ name: 'source_url', length: 500 })
  sourceUrl: string;
}
