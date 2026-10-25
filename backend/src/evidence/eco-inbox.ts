/**
 * ECO-LINK1 받는 문 (SOC-R15 ■4 · 계약 v1.4 §3-3 · §6 · §7) — 순수 함수. import:eco 가 쓴다.
 *
 * 두 원천:
 *  - Statory 내보내기(build-evidence-export.mjs 꼴 · 봉투 §6-1 = readEnvelope · 줄 §6-2 = readCardLine) —
 *    paper_id(ASK-54 · 판을 넘는 논문 열쇠) · card_version · missing[] · license(낱말 · 옛 객체 꼴) · license_use.
 *  - 중독뉴스 export v0(GET /api/export/articles · docs/EXPORT_V0.md) — sourceType · subtype[] · sourceEn
 *    (NEWS-Q12 이 더함 · 없으면 옛 꼴: 당긴 kind 로 등급 · category 대응표 §7 로 subtype).
 *
 * 받은 줄은 모두 **검수 대기**로 들어간다(review_decision NULL) — 단 같은 열쇠의 사람 결정이 있으면
 * 계약 v1.4 대로 이어받는다(inheritDecision · keep 이면 keep_from_version 표식).
 * SOC-R15 C1: 물려받은 keep 은 손님에게 그대로 보이고, 표식은 관리자 화면에만(guestView 에 싣지 않음).
 * SOC-R15 C2: paper_id 를 가진 줄이 오면 같은 card_id 의 옛 card 열쇠 행을 paper 열쇠로 한 번 옮겨 적는다
 *   (행 지움 0 · key_moved_from · key_moved_at 기록) — 그 뒤 상속을 잰다(옛 결정이 새 판으로 이어짐).
 */
import {
  cardKeyOf,
  cardKeysOf,
  inheritDecision,
  type ReviewDecision,
  type StoredCard,
} from './card-decisions';
import type { EnvelopeRead } from './card-envelope';

export type Origin = 'statory' | 'addicted-news';

/** 계약 §1 하위 유형 열 id(차례 그대로 · 별칭은 id 아님) */
export const SUBTYPE_IDS: readonly string[] = [
  'alcohol',
  'drugs',
  'nicotine',
  'gambling',
  'gaming',
  'shopping',
  'work',
  'smartphone',
  'food',
  'ai',
];
/** 계약 §1 가로 주제 v1 어휘 */
export const CROSS_TOPICS: readonly string[] = ['recovery'];
/** 계약 §5 면허 값 여섯 · 허용 넷 */
export const LICENCE_WORDS: readonly string[] = [
  'cc-by',
  'cc-by-sa',
  'cc0',
  'kogl-1',
  'index-only',
  'unknown',
];
export const LICENCE_CORPUS: readonly string[] = [
  'cc-by',
  'cc-by-sa',
  'cc0',
  'kogl-1',
];

export type LineReject =
  | 'card_id_missing'
  | 'card_version_missing'
  | 'title_missing'
  | 'authors_not_array'
  | 'year_invalid'
  | 'doi_missing'
  | 'source_url_invalid'
  | 'statory_page_url_invalid'
  | 'subtype_unknown'
  | 'topic_unknown'
  | 'cross_topic_unknown'
  | 'paper_id_invalid'
  | 'paper_id_duplicate'
  | 'id_invalid'
  | 'source_type_missing'
  | 'tier_not_publish';

/** 받는 표에 들어갈 한 줄(eco_inbox · 결정 칸 앞) */
export interface InboxLine {
  origin: Origin;
  slug: string;
  version: string;
  paperKey: string;
  /** Statory card_id(C2 짝 찾기) · 중독뉴스 null */
  cardId: string | null;
  title: string;
  url: string | null;
  grade: 'paper' | 'broadcast' | 'article';
  kind: 'card' | 'broadcast' | 'article';
  subtype: string[];
  topic: string | null;
  licence: string | null;
  licenceUse: string | null;
  missing: string[] | null;
  payload: Record<string, unknown>;
}

export interface LineRead {
  line: InboxLine | null;
  reject: LineReject | null;
  /**
   * 거절된 줄이 가리킬 수 있는 slug(알 수 있으면) — 원천에 아직 있는 것이므로 withdrawn 하지 않는다(리뷰 B1).
   * null = 알 수 없음(id 도 없는 줄) → 그 회차는 withdrawn 을 돌리지 않음.
   */
  slugs?: string[] | null;
  /** 모르는 열쇠 · 받지 않는 열쇠(§6-2 unreceived_keys) */
  unreceived: { key: string; why: 'unknown' | 'ours' }[];
}

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const isHttps = (v: string) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/** 하위 유형 배열 — null/없음 = [] · 글 아닌 것 · 사전 밖 · 별칭 = null(줄 거절 subtype_unknown) */
function subtypesOf(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const s of v) {
    if (typeof s !== 'string' || !SUBTYPE_IDS.includes(s.trim())) return null;
    if (!out.includes(s.trim())) out.push(s.trim());
  }
  return out;
}

const reject = (
  r: LineReject,
  unreceived: LineRead['unreceived'] = [],
  slugs: string[] | null = null,
): LineRead => ({
  line: null,
  reject: r,
  unreceived,
  slugs,
});

// ── Statory 카드 줄(§6-2) ─────────────────────────────────────────────────

/** §6-2 의 열쇠(Statory 나가는 이름 그대로) + 봉투가 줄마다 붙이는 둘 */
const CARD_KEYS = new Set([
  'card_id',
  'card_version',
  'paper_id',
  'title',
  'authors',
  'year',
  'venue',
  'doi',
  'source_url',
  'population',
  'region',
  'addiction_type',
  'design',
  'sample',
  'key_findings',
  'limitations',
  'statory_page_url',
  'license',
  'license_use',
  'judged_at',
  'fields_missing',
  'topics',
  'topic',
  'field_id',
  'generated_at',
]);
/** 받지 않는다 — 우리가 채운다(§6-2) */
const CARD_OURS = new Set(['related_indicators']);

/** license(낱말 · 옛 객체 {value, use}) → 값 여섯 가운데 하나 · 쓰임 */
export function licenceOf(
  license: unknown,
  licenseUse: unknown,
): { licence: string; licenceUse: string | null } {
  let value: unknown = license;
  let use: unknown = licenseUse;
  if (license && typeof license === 'object' && !Array.isArray(license)) {
    // 옛 꼴(ASK-51 전) — 넘어가는 동안만
    const o = license as { value?: unknown; use?: unknown };
    value = o.value;
    use = use ?? o.use;
  }
  const word = typeof value === 'string' ? value.trim() : '';
  return {
    licence: LICENCE_WORDS.includes(word) ? word : 'unknown',
    licenceUse: text(use),
  };
}

/**
 * Statory 줄 하나(§6-2). paper_id 꼴 · 봉투 안 겹침은 cardKeysOf 가 따로 잰다(readCardLines).
 * 줄 거절은 그 줄만 — 나머지 줄은 받는다.
 */
export function readCardLine(
  item: unknown,
  missingByCard?: Map<string, string[]>,
): LineRead {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return reject('card_id_missing');
  }
  const r = item as Record<string, unknown>;
  const unreceived: LineRead['unreceived'] = [];
  for (const k of Object.keys(r)) {
    if (CARD_OURS.has(k)) unreceived.push({ key: k, why: 'ours' });
    else if (!CARD_KEYS.has(k)) unreceived.push({ key: k, why: 'unknown' });
  }
  const cardId = text(r.card_id);
  if (!cardId) return reject('card_id_missing', unreceived);
  // card_id 를 안 뒤의 거절은 그 카드 slug + 논문 열쇠를 실어 보낸다(원천에 있음 → withdrawn 0 · 리뷰 B1).
  // card_id 는 판마다 새 uuid 라 slug 만으로는 앞 판 행을 못 지킨다 — 논문 열쇠로도 지킴(반박 1)
  const paperKey = cardKeyOf(r).key;
  const no = (x: LineReject) =>
    reject(x, unreceived, [
      `statory:card:${cardId}`,
      ...(paperKey ? [paperKey] : []),
    ]);
  const version = text(r.card_version);
  if (!version) return no('card_version_missing');
  const title = text(r.title);
  if (!title) return no('title_missing');
  if (r.authors != null && !Array.isArray(r.authors)) {
    return no('authors_not_array');
  }
  if (r.year != null) {
    const y = r.year;
    const thisYear = new Date().getUTCFullYear();
    if (
      typeof y !== 'number' ||
      !Number.isInteger(y) ||
      y < 1900 ||
      y > thisYear
    ) {
      return no('year_invalid');
    }
  }
  const doi = text(r.doi);
  if (!doi || !doi.startsWith('10.')) return no('doi_missing');
  const sourceUrl = text(r.source_url);
  if (!sourceUrl || !isHttps(sourceUrl)) return no('source_url_invalid');
  if (r.statory_page_url != null) {
    const p = text(r.statory_page_url);
    if (!p || !isHttps(p)) return no('statory_page_url_invalid');
  }
  const subtype = subtypesOf(r.addiction_type);
  if (!subtype) return no('subtype_unknown');
  if (r.topics != null) {
    if (!Array.isArray(r.topics) || r.topics.some((t) => t !== 'addiction')) {
      return no('topic_unknown');
    }
  }
  let topic: string | null = null;
  if (r.topic != null) {
    topic = text(r.topic);
    if (!topic || !CROSS_TOPICS.includes(topic)) {
      return no('cross_topic_unknown');
    }
  }
  const key = cardKeyOf(r);
  if (key.reject) return no(key.reject);
  const lic = licenceOf(r.license, r.license_use);
  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(r)) if (CARD_KEYS.has(k)) payload[k] = r[k];
  return {
    line: {
      origin: 'statory',
      slug: `statory:card:${cardId}`,
      version,
      paperKey: key.key!,
      cardId,
      title: title.slice(0, 1000),
      url: sourceUrl,
      grade: 'paper',
      kind: 'card',
      subtype,
      topic,
      licence: lic.licence,
      licenceUse: lic.licenceUse,
      missing: missingByCard?.get(cardId) ?? null,
      payload,
    },
    reject: null,
    unreceived,
  };
}

export interface LinesRead {
  lines: InboxLine[];
  rejected: { index: number; reason: LineReject }[];
  unreceived: { index: number; key: string; why: 'unknown' | 'ours' }[];
  /**
   * 거절됐지만 원천에 아직 있는 slug — withdrawn 에서 뺀다(리뷰 B1). null = 어떤 거절 줄은 slug 를 알 수 없음
   * → 그 회차는 withdrawn 을 돌리지 않는다(넘겨짚어 내리지 않음).
   */
  protect: Set<string> | null;
}

/** 거절 줄의 slug 를 모은다 — 하나라도 모르면 null */
function protectOf(acc: Set<string> | null, r: LineRead): Set<string> | null {
  if (!acc || !r.slugs) return null;
  for (const s of r.slugs) acc.add(s);
  return acc;
}

/** 봉투(readEnvelope 가 받은 것)의 줄들 — 다른 §6-2 검사를 지난 줄끼리만 paper_id 겹침을 잰다(리뷰 6 · R14) */
export function readCardLines(env: EnvelopeRead): LinesRead {
  const out: LinesRead = {
    lines: [],
    rejected: [],
    unreceived: [],
    protect: new Set(),
  };
  const passed: { index: number; line: InboxLine; raw: unknown }[] = [];
  env.items.forEach((item, index) => {
    const r = readCardLine(item, env.missingByCard);
    for (const u of r.unreceived) out.unreceived.push({ index, ...u });
    if (r.line) passed.push({ index, line: r.line, raw: item });
    else {
      out.rejected.push({ index, reason: r.reject! });
      out.protect = protectOf(out.protect, r);
    }
  });
  // 같은 판(card_id, card_version)이 한 봉투에 둘이면 뒤 줄은 담지 않는다(멱등 · 같은 행)
  const pairs = new Set<string>();
  const keys = cardKeysOf(passed.map((p) => p.raw));
  passed.forEach((p, i) => {
    if (keys[i].reject) {
      out.rejected.push({ index: p.index, reason: keys[i].reject });
      out.protect?.add(p.line.slug);
      out.protect?.add(p.line.paperKey);
      return;
    }
    const pair = `${p.line.slug}\u0000${p.line.version}`;
    if (pairs.has(pair)) return;
    pairs.add(pair);
    out.lines.push(p.line);
  });
  out.rejected.sort((a, b) => a.index - b.index);
  return out;
}

// ── 중독뉴스 export v0(§7) ─────────────────────────────────────────────────

/** category → subtype · topic(계약 §7 대응표 · 하나 대 여럿은 넘겨짚지 않음) — 옛 꼴(subtype 없음)에서만 */
const CATEGORY_MAP: Record<
  string,
  { subtype: string[]; topic: string | null }
> = {
  도박중독: { subtype: ['gambling'], topic: null },
  '알코올·약물중독': { subtype: [], topic: null },
  '게임·디지털중독': { subtype: [], topic: null },
  중독정책: { subtype: [], topic: null },
  중독사회와회복: { subtype: [], topic: 'recovery' },
};

const NEWS_KEYS = new Set([
  'id',
  'title',
  'source',
  'publishedAt',
  'publishedTs',
  'sourceUrl',
  'field',
  'category',
  'clusterId',
  'tier',
  'sourceGrade',
  'sourceType',
  'subtype',
  'sourceEn',
]);

/**
 * export v0 봉투 — `{ field: 'addiction', version: 'v0', items[], nextCursor }`. 틀리면 null(그 회차 전체를 건너뜀 ·
 * 숨김 상속 돌리지 않음 · §6-1 과 같은 읽기).
 */
export function readNewsPage(
  body: unknown,
): { items: unknown[]; nextCursor: string | null } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.field !== 'addiction' || b.version !== 'v0') return null;
  if (!Array.isArray(b.items)) return null;
  const cursor = b.nextCursor;
  if (cursor !== null && cursor !== undefined && typeof cursor !== 'string') {
    return null;
  }
  return { items: b.items, nextCursor: text(cursor) };
}

/**
 * 중독뉴스 줄 하나. pullKind = 당긴 kind(article · broadcast) — sourceType 이 없는 옛 꼴의 등급 자리(§7).
 * subtype 이 있으면 그 값(사전 밖 · 별칭 = subtype_unknown · §1) · 없으면 category 대응표.
 */
export function readNewsLine(
  item: unknown,
  pullKind: 'article' | 'broadcast' | 'all',
): LineRead {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return reject('id_invalid');
  }
  const r = item as Record<string, unknown>;
  const unreceived: LineRead['unreceived'] = Object.keys(r)
    .filter((k) => !NEWS_KEYS.has(k))
    .map((key) => ({ key, why: 'unknown' as const }));
  const id = r.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    return reject('id_invalid', unreceived);
  }
  // tier 가 publish 가 아니면 실림이 아니므로 지킬 것이 없다(빠진 것과 같음) — 다른 검사보다 먼저(반박 7)
  if (r.tier !== undefined && r.tier !== null && r.tier !== 'publish') {
    return reject('tier_not_publish', unreceived, []);
  }
  // id 를 안 뒤의 거절은 그 기사 slug(두 kind)를 실어 보낸다(원천에 있음 → withdrawn 0 · 리뷰 B1)
  const no = (x: LineReject) =>
    reject(x, unreceived, [
      `addicted-news:article:${id}`,
      `addicted-news:broadcast:${id}`,
    ]);
  const title = text(r.title);
  if (!title) return no('title_missing');
  const url = text(r.sourceUrl);
  if (!url || !/^https?:\/\//.test(url)) return no('source_url_invalid');
  const st = text(r.sourceType);
  const kind: 'article' | 'broadcast' | null = st
    ? st === 'broadcast'
      ? 'broadcast'
      : 'article'
    : pullKind === 'all'
      ? null
      : pullKind;
  if (!kind) return no('source_type_missing');
  let subtype: string[] | null;
  let topic: string | null = null;
  const cat = text(r.category)?.replace(/\s+/g, '') ?? '';
  if (r.subtype !== undefined) {
    subtype = subtypesOf(r.subtype);
    topic = CATEGORY_MAP[cat]?.topic ?? null;
  } else {
    subtype = CATEGORY_MAP[cat]?.subtype ?? [];
    topic = CATEGORY_MAP[cat]?.topic ?? null;
  }
  if (!subtype) return no('subtype_unknown');
  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(r)) if (NEWS_KEYS.has(k)) payload[k] = r[k];
  const slug = `addicted-news:${kind}:${id}`;
  return {
    line: {
      origin: 'addicted-news',
      slug,
      version: '',
      paperKey: slug,
      cardId: null,
      title: title.slice(0, 1000),
      url,
      grade: kind,
      kind,
      subtype,
      topic,
      licence: null,
      licenceUse: null,
      missing: null,
      payload,
    },
    reject: null,
    unreceived,
  };
}

/** 여러 쪽의 중독뉴스 줄 — 같은 id 가 두 번 오면(쪽 겹침) 뒤 줄은 담지 않음 */
export function readNewsLines(
  pages: { items: unknown[]; kind: 'article' | 'broadcast' | 'all' }[],
): LinesRead {
  const out: LinesRead = {
    lines: [],
    rejected: [],
    unreceived: [],
    protect: new Set(),
  };
  const seen = new Set<string>();
  let index = 0;
  for (const p of pages) {
    for (const item of p.items) {
      const r = readNewsLine(item, p.kind);
      for (const u of r.unreceived) out.unreceived.push({ index, ...u });
      if (!r.line) {
        out.rejected.push({ index, reason: r.reject! });
        out.protect = protectOf(out.protect, r);
      } else if (!seen.has(r.line.slug)) {
        seen.add(r.line.slug);
        out.lines.push(r.line);
      }
      index++;
    }
  }
  return out;
}

// ── 계획(받는 표에 무엇을 쓰나) ───────────────────────────────────────────

/** 받는 표에 이미 있는 행(한 원천) */
export interface StoredInbox {
  id: number;
  slug: string;
  version: string;
  paperKey: string;
  upstream: string;
  reviewDecision: ReviewDecision;
  reviewedAt: Date | null;
  keepFromVersion: string | null;
  keyMovedFrom: string | null;
}

export interface InboxPlan {
  /** 새 줄 — 결정 칸은 상속(사람 결정이 아니므로 reviewed_at NULL) */
  insert: (InboxLine & {
    reviewDecision: ReviewDecision;
    keepFromVersion: string | null;
    inheritedFrom: string | null;
  })[];
  /** 이번에 본 옛 행(last_seen · withdrawn → public) */
  seen: number[];
  /** 본 옛 행의 내용 칸 새로 맞춤(제목 · 하위 유형 · payload … · 결정 칸은 건드리지 않음 · 리뷰 B3) */
  refresh: { id: number; line: InboxLine }[];
  /** 다시 보임(withdrawn → public) */
  republic: number[];
  /** 이번 전부 당기기에 없음 → withdrawn(행 지움 0) */
  withdraw: number[];
  /** C2: 옛 card 열쇠 → paper 열쇠(한 번) */
  keyMoves: { id: number; from: string; to: string }[];
}

/**
 * 한 원천의 한 회차 계획. full = 「전부 당기기」가 끝까지 됐나(아니면 withdrawn 을 돌리지 않음 — 깨진 회차로
 * 받은 것이 통째로 내려가지 않게 · §6-1). protect = 거절됐지만 원천에 아직 있는 slug(withdrawn 에서 뺌) ·
 * null 이면 어떤 거절 줄의 slug 를 모름 → withdrawn 을 돌리지 않음(리뷰 B1).
 */
export function planInbox(
  stored: StoredInbox[],
  lines: InboxLine[],
  full: boolean,
  protect: Set<string> | null = new Set(),
): InboxPlan {
  const rows = stored.map((s) => ({ ...s }));
  const keyMoves: InboxPlan['keyMoves'] = [];
  // C2 — paper 열쇠 줄의 card_id 가 옛 card 열쇠 행과 같으면 그 행의 열쇠를 옮겨 적는다(한 번 · 기록)
  for (const l of lines) {
    if (!l.cardId || !l.paperKey.startsWith('paper:')) continue;
    const old = `card:${l.cardId}`;
    for (const r of rows) {
      if (r.paperKey === old && !r.keyMovedFrom) {
        keyMoves.push({ id: r.id, from: old, to: l.paperKey });
        r.paperKey = l.paperKey;
        r.keyMovedFrom = old;
      }
    }
  }
  const bySlugVersion = new Map(
    rows.map((r) => [`${r.slug}\u0000${r.version}`, r]),
  );
  const decided: StoredCard[] = rows.map((r) => ({
    key: r.paperKey,
    cardVersion: r.version,
    decision: r.reviewDecision,
    reviewedAt: r.reviewedAt,
    keepFromVersion: r.keepFromVersion,
  }));
  const plan: InboxPlan = {
    insert: [],
    seen: [],
    refresh: [],
    republic: [],
    withdraw: [],
    keyMoves,
  };
  const seenIds = new Set<number>();
  for (const l of lines) {
    const hit = bySlugVersion.get(`${l.slug}\u0000${l.version}`);
    if (hit) {
      seenIds.add(hit.id);
      plan.seen.push(hit.id);
      plan.refresh.push({ id: hit.id, line: l });
      if (hit.upstream !== 'public') plan.republic.push(hit.id);
      continue;
    }
    // 같은 열쇠 · 같은 판인데 다른 줄(card_id 가 바뀐 같은 판 · C2 로 옮긴 행) — 그 행의 결정을 물려받되
    // 사람 keep 이면 표식을 그 판으로(inheritDecision 의 멱등 길은 표식을 비움 · 리뷰 4)
    // → 멱등 길을 건너뛰고 「사람 마지막 결정」을 그대로 잰다(판 이름에 붙인 꼬리는 어떤 저장 판과도 같지 않음)
    const twin = rows.some(
      (r) => r.paperKey === l.paperKey && r.version === l.version,
    );
    const inh = inheritDecision(
      decided,
      l.paperKey,
      twin ? `${l.version}\u0000twin` : l.version,
    );
    plan.insert.push({
      ...l,
      reviewDecision: inh.decision,
      keepFromVersion: inh.keepFromVersion,
      inheritedFrom: inh.fromVersion,
    });
  }
  if (full && protect) {
    plan.withdraw = rows
      .filter(
        (r) =>
          !seenIds.has(r.id) &&
          r.upstream === 'public' &&
          !protect.has(r.slug) &&
          !protect.has(r.paperKey),
      )
      .map((r) => r.id);
  }
  return plan;
}

// ── 화면에 내는 꼴(C1) ───────────────────────────────────────────────────

export interface InboxRowView {
  id: number;
  origin: string;
  slug: string;
  version: string;
  paperKey: string;
  title: string;
  url: string | null;
  grade: string;
  kind: string;
  subtype: string[];
  topic: string | null;
  licence: string | null;
  missing: string[] | null;
  upstream: string;
  reviewDecision: ReviewDecision;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  keepFromVersion: string | null;
  keyMovedFrom: string | null;
  payload: Record<string, unknown>;
}

/** 손님에게 서나(§6-3) — upstream public ∧ keep(물려받은 keep 도 · C1 「그대로」) */
export const isGuestVisible = (
  r: Pick<InboxRowView, 'upstream' | 'reviewDecision'>,
) => r.upstream === 'public' && r.reviewDecision === 'keep';

/** 화면 규칙(§5): 허용 넷이면 소화한 발견도 · 그 밖은 제목 + 원문 링크만 */
function findingsFor(r: InboxRowView): string[] | null {
  if (r.origin !== 'statory') return null;
  if (!r.licence || !LICENCE_CORPUS.includes(r.licence)) return null;
  const f = r.payload.key_findings;
  if (typeof f === 'string' && f.trim()) return [f.trim()];
  if (Array.isArray(f)) {
    const kept = f.filter(
      (x): x is string => typeof x === 'string' && !!x.trim(),
    );
    return kept.length > 0 ? kept : null;
  }
  return null;
}

/**
 * 손님 응답 — 검수 칸 · 표식(keep_from_version) · 열쇠 기록은 **싣지 않는다**(C1: 이어받은 keep 은 손님에게
 * 여느 승인과 똑같이 보임).
 */
export function guestView(rows: InboxRowView[]) {
  return rows.filter(isGuestVisible).map((r) => ({
    slug: r.slug,
    title: r.title,
    url: r.url,
    grade: r.grade,
    kind: r.kind,
    subtype: r.subtype,
    topic: r.topic,
    keyFindings: findingsFor(r),
    sourceEn:
      r.origin === 'addicted-news' && typeof r.payload.sourceEn === 'string'
        ? r.payload.sourceEn
        : null,
  }));
}

/** 관리자 검수 꼬리표 — 물려받은 keep 이면 「이전 판 승인」(C1) */
export const INHERITED_KEEP_LABEL = '이전 판 승인';

export type AdminTab = 'pending' | 'keep' | 'hide' | 'withdrawn';

export function adminTabOf(r: InboxRowView): AdminTab {
  if (r.upstream !== 'public') return 'withdrawn';
  return r.reviewDecision ?? 'pending';
}

/** 관리자 검수 화면 줄 — 표식이 있으면 꼬리표(이전 판 승인 · 그 판) */
export function adminView(r: InboxRowView) {
  return {
    id: r.id,
    origin: r.origin,
    slug: r.slug,
    version: r.version,
    title: r.title,
    url: r.url,
    grade: r.grade,
    subtype: r.subtype,
    licence: r.licence,
    missing: r.missing,
    upstream: r.upstream,
    reviewDecision: r.reviewDecision,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    keepFromVersion: r.keepFromVersion,
    inheritedKeep:
      r.reviewDecision === 'keep' && r.keepFromVersion
        ? { label: INHERITED_KEEP_LABEL, fromVersion: r.keepFromVersion }
        : null,
    keyMovedFrom: r.keyMovedFrom,
    guestVisible: isGuestVisible(r),
  };
}

// ── 스위치 ───────────────────────────────────────────────────────────────

/** 받는 문 스위치 env 이름 — 'true' 일 때만 켜짐(그 밖 · 없음 = 꺼짐) */
export const ECO_INBOX_SWITCH = 'ECO_LINK1_INBOX_ENABLED';

export function ecoInboxEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  // 글자 그대로만(앞뒤 빈칸 · 줄바꿈이 붙은 값은 꺼짐 · 리뷰 B6)
  return env[ECO_INBOX_SWITCH] === 'true';
}
