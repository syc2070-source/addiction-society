import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../roles.decorator';

/**
 * 역할 검사 가드 (AS-FIX-1, 감사 문제 #1).
 *
 * 감사 이전에는 JwtAuthGuard만 있었다. 그 가드는 "토큰이 유효한가"만 보므로
 * 가입만 하면 누구나 쓰기 엔드포인트를 호출할 수 있었다. 여기서 역할을 본다.
 *
 * 실패 시 403(권한 없음)이다. 401(미인증)과 구분되어야 원인 파악이 쉽다.
 * @Roles 선언이 없는 핸들러는 통과시킨다 — 이 가드는 선언된 곳에만 관여한다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string; email?: string } }>();
    const role = req.user?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException(
        `이 작업에는 ${required.join('/')} 권한이 필요합니다.`,
      );
    }
    return true;
  }
}
