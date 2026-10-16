import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** 밤 예약이 이만큼 안에 시작했을 때만 비운다(회차 하나 = 2분 안팎). */
const RECENT_RUN_MS = 60 * 60 * 1000;

/**
 * 홈 재굽기 (SOC-R6 ■3) — 04:00 밤 예약의 마지막 단계(refresh:home)가 부른다.
 *
 * 홈은 5분 ISR 이라 새벽에 아무도 오지 않으면 아침 첫 손님이 어제 그린 홈(어제의
 * 「오늘의 숫자」)을 받았다(10-16 en 실측). 여기서 홈 ko·en 을 on-demand 로 비우면
 * 다음 요청이 새로 그린다 — 예약 단계가 곧바로 ko·en 을 한 번씩 읽어 데워 둔다.
 *
 * 새 비밀값 없이: 공개 밤 기록(/api/health/nightly)의 마지막 회차가 한 시간 안에
 * 시작했을 때만 비운다. 그 밖의 호출은 409 — 아무나 불러도 홈 캐시를 흔들 수 없다.
 */
export async function POST() {
  const res = await fetch(`${API_URL}/api/health/nightly`, {
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) {
    return Response.json({ ok: false }, { status: 502 });
  }
  const body = (await res.json().catch(() => null)) as {
    lastRun?: { startedAt?: string | null } | null;
  } | null;
  const started = Date.parse(body?.lastRun?.startedAt ?? '');
  if (!Number.isFinite(started) || Date.now() - started > RECENT_RUN_MS) {
    return Response.json(
      { ok: false, reason: 'no nightly run in the last hour' },
      { status: 409 },
    );
  }
  // 홈 = app/[locale]/page.tsx → 모든 언어(ko '/' · en '/en')
  revalidatePath('/[locale]', 'page');
  return Response.json({ ok: true, revalidated: '/[locale]' });
}
