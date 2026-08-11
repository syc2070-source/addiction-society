import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ length: 100 })
  name: string;

  /**
   * 권한. 'admin'만 쓰기가 가능하다(RolesGuard).
   *
   * AS-FIX-1: 기본값을 'admin'에서 'viewer'로 낮췄다(감사 문제 #1).
   * 이전에는 신규 가입자가 곧바로 관리자가 됐다. 승격은 DB에서 손으로 한다:
   *   UPDATE users SET role='admin' WHERE email='...';
   */
  @Column({ type: 'varchar', default: 'viewer' })
  role: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
