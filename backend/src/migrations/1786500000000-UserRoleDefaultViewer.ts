import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.role 기본값 'admin' → 'viewer' (AS-FIX-1, 감사 문제 #1).
 *
 * 감사에서 확인된 사실: 회원가입이 열려 있고 role 기본값이 'admin'이며 역할을
 * 검사하는 코드가 없어, 가입 한 번으로 쓰기·관측치 승인 권한이 생겼다.
 *
 * ⚠️ **기존 행은 건드리지 않는다.** 여기서 일괄 강등하면 운영자 본인 계정까지
 *    권한을 잃어 관리 경로가 끊긴다. 기존 계정 점검·강등은 사람이 확인 후
 *    수행한다(docs/AUDIT-2026-08.md 및 AS-FIX-1 보고 참조):
 *
 *      SELECT id, email, name, role, created_at FROM users ORDER BY created_at;
 *      UPDATE users SET role='viewer' WHERE email <> '<본인 이메일>';
 */
export class UserRoleDefaultViewer1786500000000 implements MigrationInterface {
  name = 'UserRoleDefaultViewer1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'`,
    );
  }
}
