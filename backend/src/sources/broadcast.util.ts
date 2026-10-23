/**
 * 중독뉴스 방송 응답 → 연대기 「방송」 항목 (SOC-R1 ■7). 순수 함수.
 * 응답 꼴: GET /articles/latest?kind=broadcast → Article[]
 *   (title · source · sourceUrl · googleUrl · publishedAt ...)
 * SOC-R12: sourceEn(영어 이름) · 목록에서 빠진 편 내리기(archiveDecision).
 */
import { BROADCAST_SOURCE_EN } from './broadcast-names';

export interface NewsArticle {
  title?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  googleUrl?: string | null;
  publishedAt?: string | null;
  /** 중독뉴스 내보내기 영어 이름(NEWS-Q12 ■4 · export 가 열리면) */
  sourceEn?: string | null;
}

export interface BroadcastRow {
  url: string;
  title: string;
  broadcaster: string | null;
  publishedAt: Date | null;
  grade: '방송';
  sourceEn: string | null;
}

export const DEFAULT_NEWS_API_URL =
  'https://addicted-news-backend.onrender.com';

/** 한 번에 읽는 방송 수 — 응답이 이만큼 꽉 차면 목록이 잘렸을 수 있어 내리기를 하지 않는다. */
export const BROADCAST_FETCH_LIMIT = 50;

/** 연대기에서 내린 까닭 — 중독뉴스 방송 목록에서 빠짐(보관 · 숨김 · 지움 무엇이든). */
export const SOURCE_ARCHIVED = 'source_archived';

const HANGUL = /[가-힣ㄱ-ㆎ]/;

/** 영어 이름: 중독뉴스가 준 값(한글 없음) → 정본 표 → null */
export function sourceEnOf(
  source: string | null | undefined,
  given?: string | null,
): string | null {
  const g = given?.trim();
  if (g && !HANGUL.test(g)) return g;
  return (source && BROADCAST_SOURCE_EN[source.trim()]) || null;
}

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
      sourceEn: sourceEnOf(a.source, a.sourceEn),
    });
  }
  return rows;
}

export interface StoredBroadcast {
  id: number;
  url: string;
  hiddenReason: string | null;
}

export interface ArchiveDecision {
  /** 내릴 행(지금 보이는데 목록에 없음) */
  hide: number[];
  /** 다시 보일 행(source_archived 로 내렸는데 목록에 다시 있음) */
  unhide: number[];
  /** 내리기를 하지 않은 까닭(빈 목록 · 꽉 찬 목록) — null 이면 판정함 */
  held: 'empty_feed' | 'full_feed' | null;
}

/**
 * 중독뉴스 목록에서 빠진 편 → 연대기에서 내림 · 다시 실린 편 → 다시 보임 (SOC-R12 ■1).
 * ECO 「hidden 잇기」와 같은 규칙: 원천이 내리면 우리도 내린다 · 행 지움 0.
 * 안전 장치: 목록이 비었거나(원천 고장) 한도만큼 꽉 찼으면(잘렸을 수 있음) 내리지 않는다.
 * feedSize = 응답이 실어 보낸 줄 수 그대로(리뷰 찾기 1 · 제목 없음·링크 겹침으로 거른 뒤의 수로 재면
 * 꽉 찬 50 줄이 49 로 읽혀 잘린 목록에서 내리기가 돈다).
 * 사람이 다른 까닭으로 내린 행(hidden_reason ≠ source_archived)은 건드리지 않는다.
 */
export function archiveDecision(
  stored: StoredBroadcast[],
  feedUrls: Set<string>,
  feedSize: number = feedUrls.size,
  limit: number = BROADCAST_FETCH_LIMIT,
): ArchiveDecision {
  const unhide = stored
    .filter((r) => r.hiddenReason === SOURCE_ARCHIVED && feedUrls.has(r.url))
    .map((r) => r.id);
  const held =
    feedUrls.size === 0
      ? 'empty_feed'
      : Math.max(feedSize, feedUrls.size) >= limit
        ? 'full_feed'
        : null;
  const hide = held
    ? []
    : stored
        .filter((r) => r.hiddenReason == null && !feedUrls.has(r.url))
        .map((r) => r.id);
  return { hide, unhide, held };
}
