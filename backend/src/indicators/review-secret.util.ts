import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

/**
 * 검수 토큰 서명 비밀키 (AS-PDF-RUN).
 *
 * REVIEW_TOKEN_SECRET이 있으면 그것을, 없으면 JWT_SECRET에서 파생한다.
 * 파생하는 이유: JWT_SECRET을 그대로 쓰면 두 용도가 같은 키를 공유해
 * 한쪽이 새면 다른 쪽도 무너진다. 고정 라벨로 HMAC 한 번 돌려 분리한다.
 *
 * JWT_SECRET은 AS-FIX-1에서 기동 필수값이 되었으므로 여기서 항상 값이 있다.
 */
export function reviewSecret(config: ConfigService): string {
  const explicit = config.get<string>('REVIEW_TOKEN_SECRET')?.trim();
  if (explicit) return explicit;

  const jwt = config.get<string>('JWT_SECRET')?.trim();
  if (!jwt) {
    // AS-FIX-1의 기동 검사를 통과했다면 도달할 수 없다. 방어적으로만 둔다.
    throw new Error('REVIEW_TOKEN_SECRET 또는 JWT_SECRET이 필요합니다.');
  }
  return createHmac('sha256', jwt)
    .update('addiction-society/review-token/v1')
    .digest('hex');
}
