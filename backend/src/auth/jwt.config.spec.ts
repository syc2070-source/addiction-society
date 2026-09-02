import { validateJwtEnvironment } from './jwt.config';

describe('JWT environment validation', () => {
  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace-only', '   \t  '],
  ])('rejects a %s JWT_SECRET', (_description, jwtSecret) => {
    expect(() => validateJwtEnvironment({ JWT_SECRET: jwtSecret })).toThrow(
      'JWT_SECRET must be configured and non-empty',
    );
  });

  it('accepts a configured JWT_SECRET and preserves the config object', () => {
    const config = {
      JWT_SECRET: 'test-only-secret',
      JWT_EXPIRES_IN: '15m',
    };

    expect(validateJwtEnvironment(config)).toBe(config);
  });
});
