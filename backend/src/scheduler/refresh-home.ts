/**
 * 홈 재굽기 (SOC-R6 ■3) — 매일 04:00 예약의 마지막 단계 refresh:home.
 *
 * 홈(ko·en)은 5분 ISR 이라, 새벽에 손님이 없으면 아침 첫 손님이 어제 그린 홈을 받았다
 * (10-16 실측: en 첫 요청 = 어제 숫자 「one of 7」). 수집이 끝난 뒤 사이트의
 * /api/revalidate/home 을 불러 홈을 비우고(밤 회차가 한 시간 안에 시작했을 때만 받아 줌),
 * 곧바로 ko·en 을 한 번씩 읽어 새로 그려 둔다 → 첫 손님도 오늘 숫자.
 * SOC-R7: 00:05 KST 에도 같은 단계를 한 번 더(자정 홈 재굽기 · daily-jobs MIDNIGHT_STEPS).
 *
 * 비밀값 0 · DB 0. 실패하면 exit 1(밤 기록에 fail 로 남고 알림) — 숫자는 그대로라 해가 없다.
 */
import { printJobCounts } from '../common/job-counts';

export const SITE_URL = (
  process.env.SITE_URL || 'https://www.addictionsociety.net'
).replace(/\/+$/, '');

/** 홈 언어별 주소(ko 는 접두어 없음). */
export const HOME_PATHS = ['/', '/en'];

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number }>;

export async function refreshHome(
  fetchFn: FetchLike,
  site: string = SITE_URL,
): Promise<{ revalidated: boolean; warmed: number; failed: string[] }> {
  const failed: string[] = [];
  const r = await fetchFn(`${site}/api/revalidate/home`, { method: 'POST' });
  if (!r.ok) {
    return {
      revalidated: false,
      warmed: 0,
      failed: [`revalidate ${r.status}`],
    };
  }
  let warmed = 0;
  for (const p of HOME_PATHS) {
    const g = await fetchFn(`${site}${p === '/' ? '' : p}`, {
      headers: { 'User-Agent': 'AddictionSociety-Nightly/1.0 (refresh:home)' },
    });
    if (g.ok) warmed++;
    else failed.push(`GET ${p} ${g.status}`);
  }
  return { revalidated: true, warmed, failed };
}

async function main() {
  const res = await refreshHome((url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(60_000) }),
  );
  console.log(`[refresh:home] ${JSON.stringify(res)}`);
  // DB 쓰기 0 → 수는 모두 0(합계를 흐리지 않게). 결과는 위 줄과 단계 status 로 본다.
  printJobCounts({ inserted: 0, updated: 0, skipped: 0, diff: 0 });
  if (!res.revalidated || res.failed.length > 0) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[refresh:home] 실패:', e);
    process.exit(1);
  });
}
