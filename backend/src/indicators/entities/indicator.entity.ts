import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Observation } from './observation.entity';

/**
 * 지표(indicator) — /indicators 페이지의 SEO 단위(지표당 1페이지).
 * "무엇인가"에 답한다. 관측치(observations)의 정의·단위·출처를 담는 메타 테이블.
 *
 * 블루프린트 불변 원칙:
 *  - 원칙4: 정의 없는 지표 금지 → definition_ko NOT NULL.
 *  - 원칙5: 1차 소스(reliability=1)만 지표로 → source_id는 sources 레지스트리 FK.
 */
@Entity('indicators')
export class Indicator {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 안정적 슬러그. SEO URL(/indicators/{code})의 키이자 멱등 upsert 키.
   * 예: 'who_alcohol_pcc', 'euda_drug_induced_deaths', 'kcgp_youth_gambling_rate'.
   */
  @Index({ unique: true })
  @Column({ length: 100 })
  code: string;

  /** 중독 도메인 코드(D0~D3). 소스 도메인(alcohol/drug/gambling/digital)과 대응. */
  @Column({ length: 20 })
  domain: string;

  @Column({ name: 'name_ko', length: 300 })
  nameKo: string;

  // type 명시: TS 유니언(string|null)은 design:type이 Object로 반사되어 명시 없으면
  // postgres 매핑 실패. 아래 nullable varchar 컬럼은 모두 type을 명시한다.
  @Column({ name: 'name_en', type: 'varchar', length: 300, nullable: true })
  nameEn: string | null;

  /** 측정 단위(예: '순알코올 리터', '%', '명', '건'). 무차원 비율은 null 가능. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  unit: string | null;

  /** 정의(원칙4 — NOT NULL). 출처 방법론 문서에서 발췌·번역. */
  @Column({ name: 'definition_ko', type: 'text' })
  definitionKo: string;

  /** 산출 방법·주의사항(caveat). EUDA/WHO 방법론 노트 요약. */
  @Column({ name: 'method_note', type: 'text', nullable: true })
  methodNote: string | null;

  /**
   * sources 레지스트리 연계 키(nullable FK → sources.id). 원칙5(1차 소스)의 근거.
   * 여러 소스를 합성한 파생 지표는 null 가능(그 경우 method_note에 근거 명시).
   * FK 제약은 마이그레이션에서 부여(documents.source_id와 동일 패턴).
   */
  @Column({ name: 'source_id', type: 'text', nullable: true })
  sourceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Observation, (obs) => obs.indicator)
  observations: Observation[];
}
