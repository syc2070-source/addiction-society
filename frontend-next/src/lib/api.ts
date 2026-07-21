/**
 * 백엔드 API 클라이언트 (서버 컴포넌트용).
 * NEXT_PUBLIC_API_URL: 로컬 http://localhost:3001 / 운영 https://addiction-society-api.onrender.com
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SummaryItem {
  id: string;
  date: string;
  label: string;
  org: string;
}

export interface SourcesSummary {
  total: number;
  byScope: Record<string, number>;
  recent: SummaryItem[];
  upcoming: SummaryItem[];
}

/**
 * 관측소 요약. 실패 시 null — 화면은 "수집 중"으로 처리(가짜 데이터 금지, 불변 원칙 1).
 * 5분 재검증: 발표 감시 주기(일 1회) 대비 충분히 신선하고 백엔드 부하 없음.
 */
export async function fetchSourcesSummary(): Promise<SourcesSummary | null> {
  try {
    const res = await fetch(`${API_URL}/api/sources/summary`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as SourcesSummary;
  } catch {
    return null;
  }
}
