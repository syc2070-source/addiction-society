import { SetMetadata } from '@nestjs/common';

/** RolesGuard가 읽는 메타데이터 키 */
export const ROLES_KEY = 'requiredRoles';

/**
 * 이 엔드포인트에 필요한 역할을 선언한다 (AS-FIX-1).
 *
 * 반드시 JwtAuthGuard와 **함께** 쓴다 — RolesGuard는 인증을 하지 않고
 * 이미 인증된 request.user의 role만 본다.
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** 쓰기 권한을 가진 역할. 신규 가입 기본값 'viewer'는 여기 없다. */
export const ROLE_ADMIN = 'admin';
