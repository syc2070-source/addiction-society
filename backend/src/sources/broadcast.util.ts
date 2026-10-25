/**
 * 중독뉴스 방송 응답 → 연대기 「방송」 항목 (SOC-R1 ■7). 순수 함수.
 * 응답 꼴: GET /articles/latest?kind=broadcast → Article[]
 *   (title · source · sourceUrl · googleUrl · publishedAt ...)
 * SOC-R12: sourceEn(영어 이름) · 목록에서 빠진 편 내리기(archiveDecision).
 * SOC-R13: newsId(중독뉴스 id) · 보관 목록 길(archiveListDecision · GET /api/broadcast/archive?tier=all).
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
/** 연대기에서 내린 까닭 — 중독뉴스가 그 편을 지움(보관 목록 tier deleted · SOC-R14 ■3). */
export const SOURCE_DELETED = 'source_deleted';
/**
 * 연대기에서 내린 까닭 — 전 기간 목록이 정본일 때(SOC-R15 ■3 · CTO C3) 그 목록에 없는 편
 * (막힘 · 거부 따위 · 중독뉴스가 공개하지 않는 편).
 */
export const SOURCE_UNLISTED = 'source_unlisted';
/** 원천이 정한 숨김 — 원천이 다시 실으면 다시 보인다(사람 숨김은 아님) */
const SOURCE_REASONS: readonly string[] = [
  SOURCE_ARCHIVED,
  SOURCE_DELETED,
  SOURCE_UNLISTED,
];

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
  // 원천 까닭 둘(보관 · 지움) 모두 — 목록 길이 못 돌 때도 지운 편이 다시 실리면 다시 보임(리뷰 찾기 2)
  const unhide = stored
    .filter(
      (r) =>
        r.hiddenReason != null &&
        SOURCE_REASONS.includes(r.hiddenReason) &&
        feedUrls.has(r.url),
    )
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
 * 보관 목록 주소(중독뉴스 기준 경로) — 중독뉴스 docs/BROADCAST_ARCHIVE_LIST.md(NEWS-Q14 7bd50d7 · 10-24 08:17).
 * tier=all = 실림(publish)도 실림 — 손으로 되돌린 편을 다시 보이는 데 쓴다.
 * null 로 두면 「대기」: 지금 규칙(archiveDecision · 방송 목록에서 빠진 편 = 내림).
 * 10-24 09:0x 실측: 200 · available true · count 37(archive 28 · publish 9) · truncated false · id 정수 ·
 * 우리가 숨긴 11 = archive 11/11 · 연대기 9 = publish 9/9.
 */
export const BROADCAST_ARCHIVE_LIST_PATH: string | null =
  '/api/broadcast/archive?tier=all';

export interface ArchiveListEntry {
  id: number;
  /** deleted = 중독뉴스가 지운 편(NEWS-Q15 ■1 · 들어오기 전엔 없음) */
  tier: 'archive' | 'publish' | 'deleted';
  changedAt: Date | null;
  /** YouTube 영상 id(NEWS-Q15 ■1 · 들어오기 전엔 null) — news_id 를 모르는 옛 행을 링크의 영상 id 로 맞춘다 */
  videoId: string | null;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** 링크 → YouTube 영상 id(watch?v= · youtu.be/ · /shorts/ · /embed/ · /live/) · 아니면 null */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, head, tail] = u.pathname.split('/');
    id =
      head === 'watch'
        ? u.searchParams.get('v')
        : ['shorts', 'embed', 'live', 'v'].includes(head ?? '')
          ? (tail ?? null)
          : null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/**
 * 보관 목록 응답 → 줄들. 꼴(중독뉴스 docs/BROADCAST_ARCHIVE_LIST.md):
 *   { kind, tier, days, generatedAt, available, count, truncated, items: [{ id, tier, changedAt }] } (배열만 와도 받음)
 * available false(그쪽 DB 에 tier 열이 없음 · 못 닿음 → items []) 는 「보관 0」이 아니라 「모름」 → null(지금 규칙).
 * 줄 하나라도 꼴이 틀리면 목록 전체를 믿지 않는다(null → 지금 규칙) — 반쯤 읽은 목록으로 내리지 않게.
 */
export function parseArchiveList(body: unknown): ArchiveListEntry[] | null {
  const env = body as { items?: unknown; available?: unknown } | null;
  if (!Array.isArray(body) && env?.available === false) return null;
  const raw: unknown = Array.isArray(body) ? body : env?.items;
  if (!Array.isArray(raw)) return null;
  const out: ArchiveListEntry[] = [];
  for (const e of raw as Record<string, unknown>[]) {
    const id = positiveInt(e?.id);
    const tier = e?.tier;
    if (id === null) return null;
    // 모르는 tier(그쪽이 낱말을 더함)는 그 줄만 쓰지 않는다 — 짝이 없는 행은 그대로(리뷰 찾기 2 · 목록 전체를 버리지 않음)
    if (tier !== 'archive' && tier !== 'publish' && tier !== 'deleted') {
      continue;
    }
    const at = e.changedAt ?? e.changed_at;
    const ts = typeof at === 'string' ? new Date(at) : null;
    const vid = e.videoId ?? e.video_id;
    out.push({
      id,
      tier,
      changedAt: ts && !Number.isNaN(ts.getTime()) ? ts : null,
      // 꼴이 틀린 영상 id 는 맞추는 데 쓰지 않는다(우리 쪽 영상 id 도 같은 꼴만 읽음 → 엉뚱한 짝 0)
      videoId: typeof vid === 'string' && VIDEO_ID.test(vid) ? vid : null,
    });
  }
  return out;
}

/** 보관 목록 응답의 모든 id — tier 를 모르는 줄도(그 편은 「목록에 있음」 · SOC-R15 리뷰 B5) */
export function archiveListIds(body: unknown): Set<number> {
  const raw: unknown = Array.isArray(body)
    ? body
    : (body as { items?: unknown } | null)?.items;
  const ids = new Set<number>();
  if (!Array.isArray(raw)) return ids;
  for (const e of raw as Record<string, unknown>[]) {
    const id = positiveInt(e?.id);
    if (id !== null) ids.add(id);
  }
  return ids;
}

export interface ArchiveListScope {
  /** 실림(publish)이 전 기간인가(NEWS-Q16 ■4) — 120일 창이면 false */
  publishAllTime: boolean;
  truncated: boolean;
  /** 목록을 정본으로 믿나 = 전 기간 ∧ 잘리지 않음 */
  canonical: boolean;
}

/**
 * 보관 목록이 「정본」인가(SOC-R15 ■3 · CTO C3) — 중독뉴스가 방송 publish 를 전 기간으로 열었다고
 * **응답이 스스로 말할 때만**: `publishAllTime: true`(또는 publish_all_time) · `publishDays: null` ·
 * `days: null`(days = 실림에만 거는 날 수 · NEWS-Q15 docs). 10-25 실측 = `days: 120` → false(대기).
 * `truncated: true` 거나 꼴을 모르면 정본이 아니다(지금 규칙 · 「목록에 없으면 그대로」).
 */
export function archiveListScope(body: unknown): ArchiveListScope {
  const env =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const publishAllTime =
    !!env &&
    env.available !== false &&
    (env.publishAllTime === true ||
      env.publish_all_time === true ||
      ('publishDays' in env && env.publishDays === null) ||
      ('days' in env && env.days === null));
  const truncated = env?.truncated !== false;
  return { publishAllTime, truncated, canonical: publishAllTime && !truncated };
}

export interface ArchiveListDecision extends ArchiveDecision {
  /** 내릴 행 → source_archived(보이는 행 · 또는 source_deleted 였다가 보관으로 바뀐 행) */
  hide: number[];
  /** 내릴 행 → source_deleted(보이는 행 · 또는 source_archived 였다가 지워진 행) */
  hideDeleted: number[];
  /** 보이는데 방송 목록에도 보관 목록에도 없는 행 — 내리지 않고 수만 적는다(넘겨짚지 않음 · 정본이 아닐 때) */
  unlisted: number[];
  /** 정본 목록(SOC-R15 ■3)에서 그 목록에 없는 보이는 행 → source_unlisted · 정본이 아니면 늘 [] */
  hideUnlisted: number[];
  /** news_id 를 모르던 행 가운데 영상 id 로 짝을 찾은 것 → news_id 채움 */
  idFill: { id: number; newsId: number }[];
}

/**
 * 보관 목록 길(SOC-R13 ■3 · SOC-R14 ■3) — 짐작(방송 목록에서 빠짐) 대신 중독뉴스가 적은 tier 로 내린다.
 *  - 짝: 우리 행의 news_id → 목록 id · news_id 를 모르면 링크의 영상 id → 목록 videoId(NEWS-Q15 가 넣은 뒤 ·
 *    한 영상 id 에 목록 id 가 둘 이상이면 그 영상 id 로는 맞추지 않음). 짝을 찾으면 news_id 를 채운다(idFill).
 *  - 내림: 방송 목록에 없는 행 — 짝이 tier=archive → source_archived · tier=deleted → source_deleted(행 지움 0).
 *    이미 원천 까닭으로 숨긴 행의 까닭이 바뀌면(보관 → 지움) 까닭만 바꾼다.
 *  - 다시 보임(원천 까닭 둘만): 방송 목록에 다시 있음 ∨ 짝이 tier=publish(같은 news_id 가 이미 보이는 행에 있으면 옛 행은 안 살림).
 *    「보관 목록에 없음」만으로는 다시 보이지 않는다(지운 편이 tier deleted 로 오기 전 · 120일 창 밖 실림).
 *  - 짝이 없는 행: 내리지 않고 「두 목록에 없음」으로 센다.
 *  - 빈 목록: 내리지 않는다(held empty_list) — 방송 목록에 다시 있는 편은 다시 보임.
 *  - SOC-R15 ■3(CTO C3): canonical(전 기간 publish ∧ 잘리지 않음 · archiveListScope) 이면 「목록이 정본」 —
 *    보이는데 방송 목록에도 보관 목록에도 없는 행은 source_unlisted 로 내린다(행 지움 0 · 다시 실리면 다시 보임).
 *    정본이 아니면 지금 규칙(「두 목록에 없음」 = 그대로 · 수만).
 * 사람이 다른 까닭으로 내린 행은 건드리지 않는다(archiveDecision 과 같음).
 */
export function archiveListDecision(
  stored: StoredBroadcast[],
  list: ArchiveListEntry[],
  feedUrls: Set<string>,
  opts: {
    canonical?: boolean;
    /** 응답에 실린 모든 id(모르는 tier 줄 포함 · archiveListIds) — 없으면 읽은 줄의 id */
    listedIds?: { has(id: number): boolean };
  } = {},
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
  const byVideo = new Map<string, ArchiveListEntry>();
  const ambiguous = new Set<string>();
  for (const e of latest.values()) {
    if (!e.videoId) continue;
    if (byVideo.has(e.videoId)) ambiguous.add(e.videoId);
    else byVideo.set(e.videoId, e);
  }
  const knownIds = new Set(
    stored.map((r) => r.newsId).filter((x): x is number => x != null),
  );
  const videoEntry = (r: StoredBroadcast): ArchiveListEntry | undefined => {
    const vid = youtubeVideoId(r.url);
    if (!vid || ambiguous.has(vid)) return undefined;
    const e = byVideo.get(vid);
    // 그 목록 id 가 이미 다른 행의 news_id 면 짝으로 쓰지 않음(두 행이 한 편을 갖지 않게)
    return e && !knownIds.has(e.id) ? e : undefined;
  };
  // 이 회차 안에서 한 목록 id 를 영상 id 로 둘 이상의 행이 잡으면(watch?v= · youtu.be 같은 영상 두 링크) 아무도 안 씀(리뷰 찾기 1)
  const claims = new Map<number, number>();
  for (const r of stored) {
    if (r.newsId != null) continue;
    const e = videoEntry(r);
    if (e) claims.set(e.id, (claims.get(e.id) ?? 0) + 1);
  }
  const entryOf = (r: StoredBroadcast): ArchiveListEntry | undefined => {
    if (r.newsId != null) return latest.get(r.newsId);
    const e = videoEntry(r);
    return e && claims.get(e.id) === 1 ? e : undefined;
  };
  const held = list.length === 0 ? 'empty_list' : null;

  const hide: number[] = [];
  const hideDeleted: number[] = [];
  const unlisted: number[] = [];
  const hideUnlisted: number[] = [];
  const idFill: { id: number; newsId: number }[] = [];
  const visibleIds = new Set<number>();
  const matched = new Map<number, ArchiveListEntry | undefined>();
  for (const r of stored) {
    const e = entryOf(r);
    matched.set(r.id, e);
    // 사람이 다른 까닭으로 숨긴 행은 news_id 도 건드리지 않음(리뷰 6)
    const humanHidden =
      r.hiddenReason != null && !SOURCE_REASONS.includes(r.hiddenReason);
    if (e && r.newsId == null && !humanHidden) {
      idFill.push({ id: r.id, newsId: e.id });
    }
    if (e && (r.hiddenReason == null || feedUrls.has(r.url))) {
      visibleIds.add(e.id);
    }
  }
  for (const r of stored) {
    if (feedUrls.has(r.url)) continue;
    const e = matched.get(r.id);
    const visible = r.hiddenReason == null;
    const bySource =
      r.hiddenReason != null && SOURCE_REASONS.includes(r.hiddenReason);
    if (!visible && !bySource) continue;
    if (!e) {
      if (!visible) continue;
      // 「목록에 없음」을 아는 것은 news_id 를 아는 행뿐 — 영상 id 로 못 맞춘 행 · 모르는 tier 로 빠진 줄은
      // 「없음」이 아니라 「못 맞춤」이라 그대로(리뷰 B5)
      const absent =
        r.newsId != null && !(opts.listedIds ?? latest).has(r.newsId);
      if (opts.canonical && !held && absent) hideUnlisted.push(r.id);
      else unlisted.push(r.id);
      continue;
    }
    if (held) continue;
    if (e.tier === 'archive' && r.hiddenReason !== SOURCE_ARCHIVED) {
      hide.push(r.id);
    } else if (e.tier === 'deleted' && r.hiddenReason !== SOURCE_DELETED) {
      hideDeleted.push(r.id);
    }
  }
  const unhide = stored
    .filter((r) => {
      if (!r.hiddenReason || !SOURCE_REASONS.includes(r.hiddenReason)) {
        return false;
      }
      if (feedUrls.has(r.url)) return true;
      const e = matched.get(r.id);
      return e?.tier === 'publish' && !visibleIds.has(e.id);
    })
    .map((r) => r.id);
  return { hide, hideDeleted, unhide, held, unlisted, hideUnlisted, idFill };
}
