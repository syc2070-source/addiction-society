import { revalidatePath } from 'next/cache';
import { recentRun, type RunStart } from '@/lib/recentRun';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * 홈 재굽기 (SOC-R6 ■3 · SOC-R7 ■1) — 04:00 밤 예약의 마지막 단계와 00:05 자정
 * 재굽기(둘 다 refresh:home)가 부른다.
 *
 * 홈은 5분 ISR 이라 새벽에 아무도 오지 않으면 아침 첫 손님이 어제 그린 홈(어제의
 * 「오늘의 숫자」)을 받았다(10-16 en 실측). 여기서 홈 ko·en 을 on-demand 로 비우면
 * 다음 요청이 새로 그린다 — 예약 단계가 곧바로 ko·en 을 한 번씩 읽어 데워 둔다.
 * 「오늘의 숫자」는 KST 자정에 바뀌므로 00:05 에도 한 번(SOC-R7).
 *
 * 새 비밀값 없이: 공개 밤 기록(/api/health/nightly)의 lastRun 또는 lastRefresh 가
 * 한 시간 안에 시작했을 때만 비운다(lib/recentRun). 그 밖의 호출은 409 — 아무나
 * 불러도 홈 캐시를 흔들 수 없다.
 */
export async function POST() {
  const res = await fetch(`${API_URL}/api/health/nightly`, {
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) {
    return Response.json({ ok: false }, { status: 502 });
  }
  const body = (await res.json().catch(() => null)) as {
    lastRun?: RunStart;
    lastRefresh?: RunStart;
  } | null;
  if (!recentRun(body)) {
    return Response.json(
      { ok: false, reason: 'no scheduled run in the last hour' },
      { status: 409 },
    );
  }
  // 홈 = app/[locale]/page.tsx → 모든 언어(ko '/' · en '/en')
  revalidatePath('/[locale]', 'page');
  return Response.json({ ok: true, revalidated: '/[locale]' });
}
