import { readFileSync } from 'fs';
import { join } from 'path';
import { DAILY_STEPS } from './daily-jobs.scheduler';
import { HOME_PATHS, refreshHome } from './refresh-home';

/** SOC-R6 ■3 — 04:00 예약 마지막 단계에서 홈 ko·en 재굽기 + 데우기. */
describe('refresh:home (SOC-R6 ■3)', () => {
  it('is the last nightly step: revalidates the home once, then warms ko and en; a refused revalidate fails the step', async () => {
    expect(DAILY_STEPS[DAILY_STEPS.length - 1]).toEqual({
      name: 'refresh:home',
      entry: 'scheduler/refresh-home',
    });
    expect(HOME_PATHS).toEqual(['/', '/en']);

    const calls: string[] = [];
    const ok = await refreshHome(
      (url, init) => (
        calls.push(`${init?.method ?? 'GET'} ${url}`),
        Promise.resolve({ ok: true, status: 200 })
      ),
      'https://site.test',
    );
    expect(calls).toEqual([
      'POST https://site.test/api/revalidate/home',
      'GET https://site.test',
      'GET https://site.test/en',
    ]);
    expect(ok).toEqual({ revalidated: true, warmed: 2, failed: [] });

    // 사이트가 거절(밤 회차가 한 시간 안에 없음 = 409) → 데우지 않고 실패로
    calls.length = 0;
    const refused = await refreshHome(
      (url, init) => (
        calls.push(`${init?.method ?? 'GET'} ${url}`),
        Promise.resolve({ ok: false, status: 409 })
      ),
      'https://site.test',
    );
    expect(calls).toHaveLength(1);
    expect(refused).toEqual({
      revalidated: false,
      warmed: 0,
      failed: ['revalidate 409'],
    });

    // 사이트 길은 밤 기록의 마지막 회차가 한 시간 안일 때만 비운다(비밀값 0)
    const route = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'frontend-next',
        'src',
        'app',
        'api',
        'revalidate',
        'home',
        'route.ts',
      ),
      'utf8',
    );
    expect(route).toContain("revalidatePath('/[locale]', 'page')");
    expect(route).toContain('/api/health/nightly');
    expect(route).toContain('status: 409');
  });
});
