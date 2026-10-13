import { migrationGlobs } from './data-source';

// SOC-R2 ■0 — 매일 예약은 시드를 dist(.js)로 돌린다. 그때 .ts migration 을 require 하면
// DataSource.initialize 가 실패한다(로컬 재현 · 10-11~10-13 운영 예약이 쓴 흔적 0 의 원인 추정).
describe('data-source migrationGlobs', () => {
  it('ts-node(src) keeps the .ts migrations for the CLI', () => {
    expect(
      migrationGlobs('/app/backend/src/data-source.ts', '/app/backend/src'),
    ).toEqual(['src/migrations/*.ts']);
  });

  it('compiled dist never points at .ts files', () => {
    const globs = migrationGlobs(
      '/app/backend/dist/data-source.js',
      '/app/backend/dist',
    );
    expect(globs).toEqual(['/app/backend/dist/migrations/*.js']);
    expect(globs.some((g) => g.endsWith('.ts'))).toBe(false);
  });

  it('normalises Windows separators for the glob', () => {
    expect(
      migrationGlobs('D:\\b\\dist\\data-source.js', 'D:\\b\\dist'),
    ).toEqual(['D:/b/dist/migrations/*.js']);
  });
});
