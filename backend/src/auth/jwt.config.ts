import { ConfigService } from '@nestjs/config';

const JWT_SECRET_ERROR = 'JWT_SECRET must be configured and non-empty';

function requireJwtSecret(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(JWT_SECRET_ERROR);
  }

  return value;
}

export function validateJwtEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  requireJwtSecret(config.JWT_SECRET);
  return config;
}

export function getRequiredJwtSecret(configService: ConfigService): string {
  return requireJwtSecret(configService.get<string>('JWT_SECRET'));
}
