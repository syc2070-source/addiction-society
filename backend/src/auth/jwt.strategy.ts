import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

/**
 * JWT 서명 비밀키를 강제로 요구한다 (AS-FIX-1).
 * 미설정 시 기동 실패 — 배포는 중단되고 구버전이 유지된다.
 */
export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET이 설정되지 않았습니다. 토큰 위조를 막기 위해 기동을 중단합니다. ' +
        'Render 대시보드(또는 .env)에 임의의 긴 문자열을 설정하십시오.',
    );
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // AS-FIX-1: 공개 레포에 적힌 기본 비밀키를 폴백으로 두면 토큰을 위조할 수
      // 있다. JWT_SECRET이 없으면 기동을 실패시켜 '조용히 뚫린 상태'를 막는다.
      secretOrKey: requireJwtSecret(configService),
    });
  }

  async validate(payload: { sub: number; email: string; role: string }) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
