import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner } from 'typeorm';
import { BroadcastSourceEnAndHidden1788800000000 } from '../migrations/1788800000000-BroadcastSourceEnAndHidden';
import { BroadcastNewsId1788900000000 } from '../migrations/1788900000000-BroadcastNewsId';
import { BROADCAST_SOURCE_EN } from './broadcast-names';
import {
  archiveDecision,
  archiveListDecision,
  BROADCAST_ARCHIVE_LIST_PATH,
  BROADCAST_FETCH_LIMIT,
  parseArchiveList,
  SOURCE_ARCHIVED,
  SOURCE_DELETED,
  sourceEnOf,
  toBroadcastRows,
  youtubeVideoId,
  type ArchiveListEntry,
  type StoredBroadcast,
} from './broadcast.util';
import { updatedCount } from './source-url-fixes';
import { TimelineController } from './timeline.controller';

const u = (id: number) => `https://www.youtube.com/watch?v=row${id}`;

/**
 * 10-23 실측: 연대기 20행(id 1·3~21) · 중독뉴스 방송 목록 9편 — 빠진 11편 = 중독뉴스가 10-23 12:00 에
 * 보관으로 옮긴 5868~5872 · 5874 · 5880 · 5883 · 5884 · 5893 · 5896 (우리 id 4·5·6·7·8·9·11·15·17·19·21).
 */
const ALL = [1, ...Array.from({ length: 19 }, (_, i) => i + 3)];
const IN_FEED = [1, 3, 10, 12, 13, 14, 16, 18, 20];
const ARCHIVED = [4, 5, 6, 7, 8, 9, 11, 15, 17, 19, 21];
const stored = (hidden: Record<number, string> = {}): StoredBroadcast[] =>
  ALL.map((id) => ({ id, url: u(id), hiddenReason: hidden[id] ?? null }));

describe('연대기 방송 — 원천 보관 잇기 (SOC-R12 ■1)', () => {
  it('10-23: the 11 episodes addicted-news archived come down, the 9 in its list stay', () => {
    const d = archiveDecision(stored(), new Set(IN_FEED.map(u)));
    expect(d.hide.sort((a, b) => a - b)).toEqual(ARCHIVED);
    expect(d.unhide).toEqual([]);
    expect(d.held).toBeNull();
  });

  it('an episode that is listed again shows again; already hidden ones are not hidden twice', () => {
    const hidden = Object.fromEntries(
      ARCHIVED.map((id) => [id, SOURCE_ARCHIVED]),
    );
    const d = archiveDecision(stored(hidden), new Set([...IN_FEED, 4].map(u)));
    expect(d.unhide).toEqual([4]);
    expect(d.hide).toEqual([]);
  });

  it('an empty list (source broken) or a full list (maybe cut) hides nothing', () => {
    expect(archiveDecision(stored(), new Set())).toEqual({
      hide: [],
      unhide: [],
      held: 'empty_feed',
    });
    const full = new Set(
      Array.from({ length: BROADCAST_FETCH_LIMIT }, (_, i) => u(100 + i)),
    );
    expect(archiveDecision(stored(), full).hide).toEqual([]);
    expect(archiveDecision(stored(), full).held).toBe('full_feed');
    // 꽉 찬 목록이어도 다시 실린 편은 다시 보인다
    const hidden = { 4: SOURCE_ARCHIVED };
    full.add(u(4));
    expect(
      archiveDecision(stored(hidden), full, full.size, full.size + 1).unhide,
    ).toEqual([4]);
  });

  it('review 1: a full feed of 50 with one row dropped (no title / same link) still counts as full', () => {
    const urls = new Set(
      Array.from({ length: BROADCAST_FETCH_LIMIT - 1 }, (_, i) => u(100 + i)),
    );
    // 거른 뒤 49 · 보낸 줄 50 → 꽉 참 → 내리지 않음
    expect(archiveDecision(stored(), urls, BROADCAST_FETCH_LIMIT)).toEqual({
      hide: [],
      unhide: [],
      held: 'full_feed',
    });
    // 보낸 줄도 49 면 판정한다
    expect(
      archiveDecision(stored(), urls, BROADCAST_FETCH_LIMIT - 1).held,
    ).toBeNull();
  });

  it('rows hidden for another reason are left alone (not shown again, not re-marked)', () => {
    const d = archiveDecision(
      stored({ 4: 'owner_hide', 10: 'owner_hide' }),
      new Set(IN_FEED.map(u)),
    );
    expect(d.unhide).toEqual([]);
    expect(d.hide).not.toContain(4);
    expect(d.hide).not.toContain(10);
  });

  it('the timeline only serves rows that are not hidden (rows stay in the table)', async () => {
    let where: unknown;
    const repo = {
      find: (o: { where?: unknown }) => (
        (where = o.where),
        Promise.resolve([])
      ),
    };
    const events = {
      timeline: () => Promise.resolve({ data: [], total: 0 }),
      activitySummary: () => Promise.resolve({}),
    };
    const c = new TimelineController(events as never, repo as never);
    await c.timeline();
    expect(JSON.stringify(where)).toContain('hiddenReason');
    expect(JSON.stringify(where)).toContain('isNull');
  });
});

describe('중독뉴스 방송 보관 목록 읽기 (SOC-R13 ■3)', () => {
  /** 우리 행 id ↔ 중독뉴스 id(5800 + id 로 둠) */
  const nid = (id: number) => 5800 + id;
  const storedWithIds = (
    hidden: Record<number, string> = {},
    known: number[] = ALL,
  ): StoredBroadcast[] =>
    ALL.map((id) => ({
      id,
      url: u(id),
      hiddenReason: hidden[id] ?? null,
      newsId: known.includes(id) ? nid(id) : null,
    }));
  const entry = (
    id: number,
    tier: ArchiveListEntry['tier'],
    at = '2026-10-23T03:00:00Z',
    videoId: string | null = null,
  ): ArchiveListEntry => ({
    id: nid(id),
    tier,
    changedAt: new Date(at),
    videoId,
  });
  const feed = new Set(IN_FEED.map(u));

  it('10-24 09:0x: NEWS-Q14 opened the list — read with tier=all (publish rows bring episodes back)', () => {
    expect(BROADCAST_ARCHIVE_LIST_PATH).toBe('/api/broadcast/archive?tier=all');
  });

  it('the real response (docs/BROADCAST_ARCHIVE_LIST.md · measured 10-24): envelope with items; available false = unknown, not zero', () => {
    const real = {
      kind: 'broadcast',
      tier: 'all',
      days: 120,
      generatedAt: '2026-10-24T00:00:55.064Z',
      available: true,
      count: 2,
      truncated: false,
      items: [
        { id: 5868, tier: 'archive', changedAt: '2026-10-23T03:00:41.120Z' },
        { id: 5873, tier: 'publish', changedAt: '2026-10-21T03:00:00.000Z' },
      ],
    };
    expect(parseArchiveList(real)?.map((e) => [e.id, e.tier])).toEqual([
      [5868, 'archive'],
      [5873, 'publish'],
    ]);
    expect(
      parseArchiveList({ ...real, available: false, count: 0, items: [] }),
    ).toBeNull();
  });

  it('news_id comes from the broadcast list id (positive integers only)', () => {
    const rows = toBroadcastRows([
      { id: 5805, title: 'a', sourceUrl: 'https://youtu.be/a' },
      { id: '5806', title: 'b', sourceUrl: 'https://youtu.be/b' },
      { id: -1, title: 'c', sourceUrl: 'https://youtu.be/c' },
      { title: 'd', sourceUrl: 'https://youtu.be/d' },
    ]);
    // 숫자 글도 받는다(리뷰 찾기 2 · bigint 를 글로 보내는 꼴)
    expect(rows.map((r) => r.newsId)).toEqual([5805, 5806, null, null]);
    expect(parseArchiveList([{ id: '5868', tier: 'archive' }])?.[0].id).toBe(
      5868,
    );
  });

  it('list form: array or {items}, id · tier · changedAt (or changed_at); one bad line → the whole list is not trusted', () => {
    expect(
      parseArchiveList([
        { id: 5868, tier: 'archive', changedAt: '2026-10-23T03:00:00Z' },
        { id: 5873, tier: 'publish', changed_at: '2026-10-24T03:00:00Z' },
      ]),
    ).toEqual([
      {
        id: 5868,
        tier: 'archive',
        changedAt: new Date('2026-10-23T03:00:00Z'),
        videoId: null,
      },
      {
        id: 5873,
        tier: 'publish',
        changedAt: new Date('2026-10-24T03:00:00Z'),
        videoId: null,
      },
    ]);
    expect(parseArchiveList({ items: [{ id: 1, tier: 'archive' }] })).toEqual([
      { id: 1, tier: 'archive', changedAt: null, videoId: null },
    ]);
    expect(parseArchiveList({ items: [] })).toEqual([]);
    expect(parseArchiveList({ data: [] })).toBeNull();
    expect(parseArchiveList(null)).toBeNull();
    // 모르는 tier 는 그 줄만 뺀다(SOC-R14 리뷰 찾기 2) · id 꼴 틀림은 목록 전체를 믿지 않음
    expect(
      parseArchiveList([
        { id: 1, tier: 'archive' },
        { id: 2, tier: 'hidden' },
      ])?.map((e) => e.id),
    ).toEqual([1]);
    expect(parseArchiveList([{ id: 'x', tier: 'archive' }])).toBeNull();
  });

  it('10-25 04:00 as it will run: 9 shown rows get news_id, the 11 hidden have none — nothing moves', () => {
    const hidden = Object.fromEntries(
      ARCHIVED.map((id) => [id, SOURCE_ARCHIVED]),
    );
    const list = [
      ...ARCHIVED.map((id) => entry(id, 'archive')),
      ...IN_FEED.map((id) => entry(id, 'publish')),
    ];
    const d = archiveListDecision(storedWithIds(hidden, IN_FEED), list, feed);
    expect(d).toEqual({
      hide: [],
      hideDeleted: [],
      unhide: [],
      held: null,
      unlisted: [],
      idFill: [],
    });
  });

  // ── SOC-R14 ■3 영상 id · 지운 편(NEWS-Q15) ──
  const vid = (id: number) => `vid${String(id).padStart(8, '0')}`;
  const yt = (id: number) => `https://www.youtube.com/watch?v=${vid(id)}`;
  /** 실제 링크 꼴(영상 id 가 있는 YouTube 주소)의 행 · news_id 는 known 만 */
  const ytRows = (
    hidden: Record<number, string> = {},
    known: number[] = [],
  ): StoredBroadcast[] =>
    ALL.map((id) => ({
      id,
      url: yt(id),
      hiddenReason: hidden[id] ?? null,
      newsId: known.includes(id) ? nid(id) : null,
    }));
  const ytFeed = new Set(IN_FEED.map(yt));

  it('video id from our links: watch?v= · youtu.be · shorts · embed · live; anything else null', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=O0iLhp_HQMY')).toBe(
      'O0iLhp_HQMY',
    );
    expect(youtubeVideoId('https://youtu.be/-m2jby_aqEY?t=3')).toBe(
      '-m2jby_aqEY',
    );
    expect(youtubeVideoId('https://m.youtube.com/shorts/vq2SnfXaMoA')).toBe(
      'vq2SnfXaMoA',
    );
    expect(youtubeVideoId('https://www.youtube.com/embed/PRjJ-Pz7Ep8')).toBe(
      'PRjJ-Pz7Ep8',
    );
    expect(youtubeVideoId('https://www.youtube.com/live/7FrJ3wuJDaY')).toBe(
      '7FrJ3wuJDaY',
    );
    for (const bad of [
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/@KBS60min',
      'https://example.com/watch?v=O0iLhp_HQMY',
      'not a url',
      null,
    ]) {
      expect(youtubeVideoId(bad)).toBeNull();
    }
  });

  it('list form: videoId (or video_id) and tier deleted are read; a malformed video id is not used for matching', () => {
    expect(
      parseArchiveList({
        items: [
          { id: 5868, tier: 'deleted', videoId: 'O0iLhp_HQMY' },
          { id: 5869, tier: 'archive', video_id: 'iYBho5XyWgc' },
          { id: 5870, tier: 'archive', videoId: 'x' },
        ],
      })?.map((e) => [e.id, e.tier, e.videoId]),
    ).toEqual([
      [5868, 'deleted', 'O0iLhp_HQMY'],
      [5869, 'archive', 'iYBho5XyWgc'],
      [5870, 'archive', null],
    ]);
  });

  it('waiting (no videoId, no deleted in the list yet): rows without news_id stay unmatched — the SOC-R13 behaviour', () => {
    const list = ARCHIVED.map((id) => entry(id, 'archive'));
    const d = archiveListDecision(ytRows(), list, ytFeed);
    expect(d.hide).toEqual([]);
    expect(d.unlisted.sort((a, b) => a - b)).toEqual(ARCHIVED);
    expect(d.idFill).toEqual([]);
  });

  it('video id matches old rows without news_id: fills news_id, archive → source_archived, deleted → source_deleted', () => {
    const list = [
      ...ARCHIVED.map((id) =>
        entry(id, id === 4 ? 'deleted' : 'archive', undefined, vid(id)),
      ),
      ...IN_FEED.map((id) => entry(id, 'publish', undefined, vid(id))),
    ];
    const d = archiveListDecision(ytRows(), list, ytFeed);
    expect(d.hide.sort((a, b) => a - b)).toEqual(
      ARCHIVED.filter((id) => id !== 4),
    );
    expect(d.hideDeleted).toEqual([4]);
    expect(d.unlisted).toEqual([]);
    expect(d.idFill).toHaveLength(20);
    expect(d.idFill).toContainEqual({ id: 4, newsId: nid(4) });
  });

  it('the 11 already hidden (10-24) get news_id by video id; an archived row the source later deletes changes reason only', () => {
    const hidden = Object.fromEntries(
      ARCHIVED.map((id) => [id, SOURCE_ARCHIVED]),
    );
    const list = ARCHIVED.map((id) =>
      entry(id, id === 5 ? 'deleted' : 'archive', undefined, vid(id)),
    );
    const d = archiveListDecision(ytRows(hidden, IN_FEED), list, ytFeed);
    expect(d.idFill.map((f) => f.id).sort((a, b) => a - b)).toEqual(ARCHIVED);
    expect(d.hide).toEqual([]);
    expect(d.hideDeleted).toEqual([5]);
    expect(d.unhide).toEqual([]);
  });

  it('publish brings back source_deleted too; owner hides untouched; an ambiguous or already-taken video id is never used', () => {
    const d = archiveListDecision(
      ytRows({ 4: SOURCE_DELETED, 5: 'owner_hide' }),
      [
        entry(4, 'publish', undefined, vid(4)),
        entry(5, 'publish', undefined, vid(5)),
      ],
      ytFeed,
    );
    expect(d.unhide).toEqual([4]);
    // 한 영상 id 에 목록 id 둘 → 그 영상 id 로는 맞추지 않음
    const twin = archiveListDecision(
      ytRows(),
      [
        { ...entry(4, 'archive', undefined, vid(4)) },
        { ...entry(4, 'deleted', undefined, vid(4)), id: 9999 },
      ],
      ytFeed,
    );
    expect(twin.hide).not.toContain(4);
    expect(twin.hideDeleted).not.toContain(4);
    expect(twin.idFill).toEqual([]);
    // 목록 id 가 이미 다른 행의 news_id → 영상 id 로 그 짝을 다시 쓰지 않음
    const taken = archiveListDecision(
      [
        { id: 4, url: yt(4), hiddenReason: null, newsId: null },
        { id: 99, url: yt(99), hiddenReason: null, newsId: nid(4) },
      ],
      [entry(4, 'archive', undefined, vid(4))],
      new Set(),
    );
    expect(taken.idFill).toEqual([]);
    expect(taken.hide).toEqual([99]);
  });

  it('review 1: two of our links to one video (watch?v= and youtu.be) never both claim the list entry', () => {
    const d = archiveListDecision(
      [
        { id: 4, url: yt(4), hiddenReason: SOURCE_ARCHIVED, newsId: null },
        {
          id: 50,
          url: `https://youtu.be/${vid(4)}`,
          hiddenReason: SOURCE_ARCHIVED,
          newsId: null,
        },
      ],
      [entry(4, 'publish', undefined, vid(4))],
      new Set(),
    );
    expect(d.idFill).toEqual([]);
    expect(d.unhide).toEqual([]);
  });

  it('review 2: the feed rule (list unavailable) brings back source_deleted rows listed again', () => {
    const d = archiveDecision(
      stored({ 10: SOURCE_DELETED, 12: 'owner_hide' }),
      new Set(IN_FEED.map(u)),
    );
    expect(d.unhide).toEqual([10]);
  });

  it('review 6: a human-hidden row does not get news_id by video id', () => {
    const d = archiveListDecision(
      ytRows({ 4: 'owner_hide' }),
      [entry(4, 'archive', undefined, vid(4))],
      ytFeed,
    );
    expect(d.idFill).toEqual([]);
    expect(d.hide).toEqual([]);
  });

  it('list path: the 11 listed as archive come down; the 9 in the broadcast list stay', () => {
    const list = ARCHIVED.map((id) => entry(id, 'archive'));
    const d = archiveListDecision(storedWithIds(), list, feed);
    expect(d.hide.sort((a, b) => a - b)).toEqual(ARCHIVED);
    expect(d.unhide).toEqual([]);
    expect(d.held).toBeNull();
    expect(d.unlisted).toEqual([]);
  });

  it('list path: listed as publish again → shows again; only dropping out of the list does not (deleted or past 120 days look the same)', () => {
    const hidden = Object.fromEntries(
      ARCHIVED.map((id) => [id, SOURCE_ARCHIVED]),
    );
    const list = [
      ...ARCHIVED.filter((id) => id !== 4 && id !== 5).map((id) =>
        entry(id, 'archive'),
      ),
      entry(4, 'publish', '2026-10-25T03:00:00Z'),
      // 5 는 목록에서 빠짐(지움 · 창 밖) → 그대로 숨김
    ];
    const d = archiveListDecision(storedWithIds(hidden), list, feed);
    expect(d.unhide).toEqual([4]);
    expect(d.hide).toEqual([]);
  });

  it('list path: the latest change per id wins', () => {
    const list = [
      entry(4, 'archive', '2026-10-23T03:00:00Z'),
      entry(4, 'publish', '2026-10-25T03:00:00Z'),
      entry(5, 'publish', '2026-10-20T03:00:00Z'),
      entry(5, 'archive', '2026-10-23T03:00:00Z'),
    ];
    const d = archiveListDecision(
      storedWithIds({ 4: SOURCE_ARCHIVED }),
      list,
      feed,
    );
    expect(d.unhide).toEqual([4]);
    expect(d.hide).toEqual([5]);
  });

  it('list path guards: unknown news_id is never hidden, an empty list hides nothing, a row in the broadcast list is never hidden', () => {
    const list = ARCHIVED.map((id) => entry(id, 'archive'));
    // id 를 모르는 행(4 · 5) — 내리지 않고 「두 목록에 없음」으로 센다
    const unknown = archiveListDecision(
      storedWithIds(
        {},
        ALL.filter((id) => id !== 4 && id !== 5),
      ),
      list,
      feed,
    );
    expect(unknown.hide).not.toContain(4);
    expect(unknown.unlisted).toEqual([4, 5]);
    // 빈 목록 — 내리지 않음 · 방송 목록에 다시 있는 편은 다시 보임
    const empty = archiveListDecision(
      storedWithIds({ 10: SOURCE_ARCHIVED, 4: SOURCE_ARCHIVED }),
      [],
      feed,
    );
    expect(empty).toMatchObject({ hide: [], unhide: [10], held: 'empty_list' });
    // 보관으로 적혔어도 지금 방송 목록에 있으면 내리지 않음(목록이 늦은 것)
    const both = archiveListDecision(
      storedWithIds(),
      [entry(10, 'archive')],
      feed,
    );
    expect(both.hide).toEqual([]);
    // 사람이 다른 까닭으로 내린 행은 그대로
    const owner = archiveListDecision(
      storedWithIds({ 4: 'owner_hide' }),
      [entry(4, 'publish')],
      feed,
    );
    expect(owner.unhide).toEqual([]);
  });

  it('job count reads typeorm UPDATE results as [rows, count] (10-24 04:00 counted 9 renames that did not happen)', () => {
    expect(updatedCount([[], 0])).toBe(0);
    expect(updatedCount([[{ id: 1 }], 1])).toBe(1);
  });

  it('review 1: a stale row sharing a news_id with a visible row is not brought back', () => {
    // 그쪽이 5804(우리 4)의 링크를 바꿈 → 새 행 99(news_id 5804)가 보임 · 옛 행 4 는 숨김
    const rows: StoredBroadcast[] = [
      ...storedWithIds({ 4: SOURCE_ARCHIVED }),
      { id: 99, url: u(99), hiddenReason: null, newsId: nid(4) },
    ];
    const d = archiveListDecision(
      rows,
      [entry(4, 'publish')],
      new Set([...feed, u(99)]),
    );
    expect(d.unhide).toEqual([]);
  });

  it('migration adds news_id only (nullable, no fill)', async () => {
    const sql: string[] = [];
    const runner = {
      query: (q: string) => (sql.push(q), Promise.resolve([])),
    } as unknown as QueryRunner;
    await new BroadcastNewsId1788900000000().up(runner);
    expect(sql).toEqual([
      'ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "news_id" integer NULL',
    ]);
    const down: string[] = [];
    await new BroadcastNewsId1788900000000().down({
      query: (q: string) => (down.push(q), Promise.resolve([])),
    } as unknown as QueryRunner);
    expect(down).toEqual([
      'ALTER TABLE "broadcast_items" DROP COLUMN IF EXISTS "news_id"',
    ]);
  });
});

describe('방송 영어 이름 source_en (SOC-R12 ■2)', () => {
  it('fill order: addicted-news sourceEn → canon table (program_en) → null; Hangul never stored', () => {
    expect(sourceEnOf('MBC PD수첩', 'MBC PD Note')).toBe('MBC PD Note');
    expect(sourceEnOf('MBC PD수첩')).toBe('MBC PD Notebook');
    expect(sourceEnOf('MBC PD수첩', '문화방송 PD수첩')).toBe('MBC PD Notebook');
    expect(sourceEnOf('연합뉴스TV')).toBeNull();
    expect(sourceEnOf(null)).toBeNull();
    const [row] = toBroadcastRows([
      { title: 't', source: 'KBS 추적60분', sourceUrl: 'https://youtu.be/x' },
    ]);
    expect(row.sourceEn).toBe('KBS In-Depth 60 Minutes');
  });

  it('canon table = the front table programEn, letter for letter, for all 9 channels (SOC-R13 ■1)', () => {
    const front = readFileSync(
      join(__dirname, '../../../frontend-next/src/lib/broadcastNamesEn.ts'),
      'utf8',
    );
    const entries = [
      ...front.matchAll(
        /'?([^'\n]+?)'?: \{\s*outletId: '[^']+',\s*broadcaster: '[^']+',\s*programEn: '([^']+)'/g,
      ),
    ].map(([, key, programEn]) => [key.trim(), programEn]);
    expect(entries).toHaveLength(9);
    expect(Object.fromEntries(entries)).toEqual(BROADCAST_SOURCE_EN);
  });

  it('migration adds three nullable columns and fills source_en only where empty', async () => {
    const sql: { q: string; p?: unknown[] }[] = [];
    const runner = {
      query: (q: string, p?: unknown[]) => (
        sql.push({ q, p }),
        Promise.resolve([])
      ),
    } as unknown as QueryRunner;
    await new BroadcastSourceEnAndHidden1788800000000().up(runner);
    expect(sql.slice(0, 3).map((s) => s.q)).toEqual([
      'ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "source_en" text NULL',
      'ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "hidden_reason" text NULL',
      'ALTER TABLE "broadcast_items" ADD COLUMN IF NOT EXISTS "hidden_at" timestamptz NULL',
    ]);
    const fills = sql.slice(3);
    expect(fills).toHaveLength(9);
    for (const f of fills) {
      expect(f.q).toMatch(/^UPDATE "broadcast_items" SET "source_en"/);
      expect(f.q).toContain('"source_en" IS NULL');
      expect(f.q).not.toMatch(/DELETE|hidden_reason/);
    }
    expect(fills.map((f) => f.p)).toContainEqual(['뉴스타파', 'Newstapa']);
    const down: string[] = [];
    await new BroadcastSourceEnAndHidden1788800000000().down({
      query: (q: string) => (down.push(q), Promise.resolve([])),
    } as unknown as QueryRunner);
    expect(down.every((q) => q.includes('DROP COLUMN IF EXISTS'))).toBe(true);
  });
});
