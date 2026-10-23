/**
 * 중독뉴스 방송 응답 → 연대기 「방송」 항목 (SOC-R1 ■7). 순수 함수.
 * 응답 꼴: GET /articles/latest?kind=broadcast → Article[]
 *   (title · source · sourceUrl · googleUrl · publishedAt ...)
 * SOC-R12: sourceEn(영어 이름) · 목록에서 빠진 편 내리기(archiveDecision).
 * SOC-R13: newsId(중독뉴스 id) · 보관 목록 길(archiveListDecision · 주소가 서기 전 = 대기).
 */
import { BROADCAST_SOURCE_EN } from './broadcast-names';

export interface NewsArticle {
  /** 중독뉴스 articles.id — 보관 목록과 잇는 열쇠(SOC-R13 ■3) */
  id?: number | null;
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
  newsId: number | null;
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
      newsId: positiveInt(a.id),
    });
  }
  return rows;
}

/** 양의 정수 — 수 또는 숫자 글(bigint 열을 글로 보내는 꼴 · 리뷰 찾기 2) */
function positiveInt(v: unknown): number | null {
  const n =
    typeof v === 'string' && /^\d{1,15}$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

export interface StoredBroadcast {
  id: number;
  url: string;
  hiddenReason: string | null;
  /** 중독뉴스 articles.id(SOC-R13) — 모르면 null(보관 목록 길에서 판정하지 않음) */
  newsId?: number | null;
  hiddenAt?: Date | null;
}

export interface ArchiveDecision {
  /** 내릴 행(지금 보이는데 목록에 없음 · 목록 길이면 보관 목록에 archive 로 있음) */
  hide: number[];
  /** 다시 보일 행(source_archived 로 내렸는데 목록에 다시 있음) */
  unhide: number[];
  /** 내리기를 하지 않은 까닭(빈 목록 · 꽉 찬 목록 · 빈 보관 목록) — null 이면 판정함 */
  held: 'empty_feed' | 'full_feed' | 'empty_list' | null;
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

// ── SOC-R13 ■3 중독뉴스 방송 보관 목록(NEWS-Q14 ■5) ─────────────────────────────

/**
 * 보관 목록 주소(중독뉴스 기준 경로) — NEWS-Q14 가 main docs 에 주소·꼴을 적으면 그 값을 여기 적는다.
 * null = 「대기」: 지금 규칙(archiveDecision · 방송 목록에서 빠진 편 = 내림)을 그대로 쓴다.
 * 10-24 실측: 중독뉴스 origin/main 3c4da2d = NEWS-Q14 지시서뿐(주소 · 코드 0).
 */
export const BROADCAST_ARCHIVE_LIST_PATH: string | null = null;

export interface ArchiveListEntry {
  id: number;
  tier: 'archive' | 'publish';
  changedAt: Date | null;
}

/**
 * 보관 목록 응답 → 줄들. 꼴(NEWS-Q14 지시서 ■5): id · tier · 바뀐 때(제목 · 내용 0). 배열 또는 { items }.
 * 칸 이름은 그쪽 docs 가 서면 맞춘다 — 지금은 id · tier · changedAt(또는 changed_at).
 * 줄 하나라도 꼴이 틀리면 목록 전체를 믿지 않는다(null → 지금 규칙) — 반쯤 읽은 목록으로 내리지 않게.
 */
export function parseArchiveList(body: unknown): ArchiveListEntry[] | null {
  const raw: unknown = Array.isArray(body)
    ? body
    : (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(raw)) return null;
  const out: ArchiveListEntry[] = [];
  for (const e of raw as Record<string, unknown>[]) {
    const id = positiveInt(e?.id);
    const tier = e?.tier;
    if (id === null || (tier !== 'archive' && tier !== 'publish')) return null;
    const at = e.changedAt ?? e.changed_at;
    const ts = typeof at === 'string' ? new Date(at) : null;
    out.push({
      id,
      tier,
      changedAt: ts && !Number.isNaN(ts.getTime()) ? ts : null,
    });
  }
  return out;
}

export interface ArchiveListDecision extends ArchiveDecision {
  /** 보이는데 방송 목록에도 보관 목록에도 없는 행 — 내리지 않고 수만 적는다(지움·숨김 등 · 넘겨짚지 않음) */
  unlisted: number[];
}

/**
 * 보관 목록 길(SOC-R13 ■3) — 짐작(방송 목록에서 빠짐) 대신 중독뉴스가 적은 tier 로 내린다.
 *  - 내림: 보이는 행 가운데 news_id 가 목록에 tier=archive 로 있고 지금 방송 목록(feedUrls)에 없는 것.
 *  - 다시 보임(source_archived 만): 방송 목록에 다시 있음 ∨ 보관 목록에 tier=publish(보관에서 빠져 실림으로).
 *    「보관 목록에 없음」만으로는 다시 보이지 않는다 — 그쪽이 지운 편 · 120일 창 밖으로 나간 편도 목록에 없다.
 *  - news_id 를 모르는 행: 방송 목록에 다시 있을 때만 다시 보임 · 내리지 않음.
 *  - 빈 목록: 내리지 않는다(held empty_list · 원천 고장일 수 있음) — 방송 목록에 다시 있는 편은 다시 보임.
 * 사람이 다른 까닭으로 내린 행은 건드리지 않는다(archiveDecision 과 같음).
 */
export function archiveListDecision(
  stored: StoredBroadcast[],
  list: ArchiveListEntry[],
  feedUrls: Set<string>,
): ArchiveListDecision {
  // 한 id 가 여러 번 오면(바뀐 기록) 가장 늦게 바뀐 tier 가 이긴다 · 바뀐 때 없는 줄은 가장 이른 것으로
  const latest = new Map<number, ArchiveListEntry>();
  for (const e of list) {
    const prev = latest.get(e.id);
    if (
      !prev ||
      (e.changedAt?.getTime() ?? -Infinity) >=
        (prev.changedAt?.getTime() ?? -Infinity)
    ) {
      latest.set(e.id, e);
    }
  }
  const archived = new Set<number>();
  const published = new Set<number>();
  for (const e of latest.values()) {
    (e.tier === 'archive' ? archived : published).add(e.id);
  }
  const held = list.length === 0 ? 'empty_list' : null;
  const listedArchive = (r: StoredBroadcast) =>
    r.newsId != null && archived.has(r.newsId) && !feedUrls.has(r.url);

  const visible = stored.filter((r) => r.hiddenReason == null);
  const hide = held ? [] : visible.filter(listedArchive).map((r) => r.id);
  const unlisted = visible
    .filter((r) => !feedUrls.has(r.url) && !listedArchive(r))
    .map((r) => r.id);
  // 같은 news_id 가 이미 보이는 행에 있으면(그쪽이 링크를 바꿔 새 행이 생김) 옛 행은 되살리지 않는다(리뷰 찾기 1)
  const visibleIds = new Set(
    stored
      .filter((r) => r.hiddenReason == null || feedUrls.has(r.url))
      .map((r) => r.newsId)
      .filter((x): x is number => x != null),
  );
  const unhide = stored
    .filter(
      (r) =>
        r.hiddenReason === SOURCE_ARCHIVED &&
        (feedUrls.has(r.url) ||
          (r.newsId != null &&
            published.has(r.newsId) &&
            !visibleIds.has(r.newsId))),
    )
    .map((r) => r.id);
  return { hide, unhide, held, unlisted };
}
