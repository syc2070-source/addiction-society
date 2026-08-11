import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 토큰이 있으면 해석하고, 없으면 그냥 통과시키는 가드 (AS-FIX-1, 감사 문제 #6).
 *
 * 공개 목록 API인데 관리자에게만 추가 정보를 주고 싶을 때 쓴다.
 * (/api/research는 누구나 볼 수 있어야 하지만 status=all(미검수 포함)은
 *  관리자만 가능해야 한다 — 원칙 8.)
 *
 * JwtAuthGuard와 달리 인증 실패로 throw 하지 않는다. 인증되지 않으면
 * request.user가 undefined로 남고, 컨트롤러가 그 사실로 분기한다.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser | null {
    // 토큰 없음·만료·위조 → null. 401을 던지지 않는다.
    return user || null;
  }
}
