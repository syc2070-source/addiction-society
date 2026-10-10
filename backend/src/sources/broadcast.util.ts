/**
 * 중독뉴스 방송 응답 → 연대기 「방송」 항목 (SOC-R1 ■7). 순수 함수.
 * 응답 꼴: GET /articles/latest?kind=broadcast → Article[]
 *   (title · source · sourceUrl · googleUrl · publishedAt ...)
 */
export interface NewsArticle {
  title?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  googleUrl?: string | null;
  publishedAt?: string | null;
}

export interface BroadcastRow {
  url: string;
  title: string;
  broadcaster: string | null;
  publishedAt: Date | null;
  grade: '방송';
}

export const DEFAULT_NEWS_API_URL =
  'https://addicted-news-backend.onrender.com';

export function toBroadcastRows(articles: unknown): BroadcastRow[] {
  if (!Array.isArray(articles)) return [];
  const seen = new Set<string>();
  const rows: BroadcastRow[] = [];
  for (const a of articles as NewsArticle[]) {
    const url = (a?.sourceUrl || a?.googleUrl || '').trim();
    const title = (a?.title || '').trim();
    if (!url || !title || seen.has(url)) continue; // 링크 없음 · 중복 제외
    seen.add(url);
    const ts = a.publishedAt ? new Date(a.publishedAt) : null;
    rows.push({
      url,
      title: title.slice(0, 500),
      broadcaster: a.source?.trim() || null,
      publishedAt: ts && !Number.isNaN(ts.getTime()) ? ts : null,
      grade: '방송',
    });
  }
  return rows;
}
