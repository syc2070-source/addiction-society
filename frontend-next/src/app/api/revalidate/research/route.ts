import { revalidateTag } from 'next/cache';
import { RESEARCH_CACHE_TAG } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * 공개 연구 목록 캐시 비우기 (SOC-R1 검수 창).
 * 새 비밀값 없이, 넘어온 관리자 토큰을 백엔드 관리자 길로 다시 확인한 뒤에만 비운다.
 */
export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const check = await fetch(`${API_URL}/api/admin/research/review?tab=keep`, {
    headers: { Authorization: auth },
    cache: 'no-store',
  }).catch(() => null);
  if (!check?.ok) {
    return Response.json({ ok: false }, { status: check?.status ?? 502 });
  }
  // expire 0 = 즉시 만료 → 다음 공개 요청이 새로 읽는다.
  revalidateTag(RESEARCH_CACHE_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
