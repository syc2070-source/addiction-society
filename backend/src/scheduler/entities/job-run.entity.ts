import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import type { JobCounts } from '../../common/job-counts';

/**
 * 매일 예약 기록 (SOC-R3 ■1).
 *
 * 10-10~10-13 예약이 운영에서 아무것도 쓰지 못했는데 사흘간 아무도 몰랐다(SOC-R2).
 * 이제 회차마다 행을 남기고 GET /api/health/nightly 가 숫자로 보여 준다.
 *
 * 한 회차(run_id)의 행:
 *  - step 'run:start' — 시작(status ok)
 *  - step '<npm 스크립트 이름>' — 단계마다 하나(status ok|fail, counts)
 *  - step 'run:end' — 끝(status = 단계가 모두 ok 면 ok, 아니면 fail · counts 합)
 *  - step 'run' status skipped — 이전 회차가 도는 중이거나 꺼져 있어 건너뜀
 * 00:05 자정 홈 재굽기(SOC-R7)는 'refresh:start' · 'refresh:home' · 'refresh:end' 로 따로 남는다.
 * 넣기만 한다(행을 고치지 않음). error 는 표에만 두고 공개 끝점에는 내보내지 않는다.
 */
@Entity('job_runs')
@Index('IDX_job_runs_run_id', ['runId'])
@Index('IDX_job_runs_started_at', ['startedAt'])
export class JobRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'run_id', type: 'varchar', length: 40 })
  runId: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'varchar', length: 60 })
  step: string;

  /** ok | fail | skipped */
  @Column({ type: 'varchar', length: 10 })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  counts: JobCounts | null;

  /** 실패 출력 꼬리 300자(공개 끝점에는 없음). */
  @Column({ type: 'varchar', length: 300, nullable: true })
  error: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
