import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner } from 'typeorm';
import { CreateEcoInbox1789000000000 } from '../migrations/1789000000000-CreateEcoInbox';
import {
  DAILY_STEPS,
  dailySteps,
  ECO_IMPORT_STEP,
} from '../scheduler/daily-jobs.scheduler';
import { readEnvelope } from './card-envelope';
import {
  adminTabOf,
  adminView,
  ecoInboxEnabled,
  guestView,
  INHERITED_KEEP_LABEL,
  licenceOf,
  planInbox,
  readCardLines,
  readNewsLine,
  readNewsLines,
  readNewsPage,
  type InboxLine,
  type InboxRowView,
  type StoredInbox,
} from './eco-inbox';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

const cardLines = (name: string) => {
  const env = readEnvelope(fixture(name));
  expect(env.ok).toBe(true);
  return { env, read: readCardLines(env) };
};

describe('받는 문 — Statory 내보내기 (SOC-R15 ■4 · 계약 v1.4 §6)', () => {
  it('the ASK-54 export shape: paper_id key, card_version, missing[] attached, licence words, one bad line at a time', () => {
    const { env, read } = cardLines('statory-export.json');
    expect(env.form).toBe('v1');
    expect(env.cardVersion).toBe('v4');
    // missing 의 id:null 줄은 따로(§6-1 v1.3)
    expect(env.missingRejected).toEqual([
      { index: 2, reason: 'missing_card_id_empty' },
    ]);
    expect(read.lines.map((l) => l.paperKey)).toEqual([
      'paper:item-41',
      'paper:item-42',
      'paper:item-44',
      'card:6f1c0e2a-0000-4000-8000-000000000006',
    ]);
    expect(read.rejected).toEqual([
      { index: 2, reason: 'paper_id_duplicate' },
      { index: 4, reason: 'doi_missing' },
    ]);
    const [a, b, gaming, thin] = read.lines;
    // SOC-R17 ■2: internet 은 대응표(→ smartphone) · 모르는 값 표시 없음(보낸 값은 payload 에 그대로)
    expect(gaming.subtype).toEqual(['gaming', 'smartphone']);
    expect(gaming.payload.unknown_subtype).toBeUndefined();
    expect(gaming.payload.addiction_type).toEqual(['gaming', 'internet']);
    expect(a).toMatchObject({
      origin: 'statory',
      slug: 'statory:card:6f1c0e2a-0000-4000-8000-000000000001',
      version: 'paper-card-struct-v1-r2',
      grade: 'paper',
      kind: 'card',
      subtype: ['gambling'],
      licence: 'cc-by',
      licenceUse: 'corpus',
      missing: null,
      url: 'https://doi.org/10.1007/s10899-024-0001-1',
    });
    expect(b.missing).toEqual(['license']);
    expect(b.licence).toBe('unknown');
    expect(b.subtype).toEqual([]);
    expect(thin.licence).toBe('index-only');
    // related_indicators 는 받지 않는다 — 우리 몫(unreceived · ours)
    expect(
      read.unreceived.filter((u) => u.key === 'related_indicators').length,
    ).toBe(6);
    expect(read.unreceived.every((u) => u.why === 'ours')).toBe(true);
    expect(a.payload).not.toHaveProperty('related_indicators');
  });

  it('the old shape (no card_version / missing on the envelope, licence object, no paper_id) is still received', () => {
    const { env, read } = cardLines('statory-export-old.json');
    expect(env.form).toBe('old');
    expect(read.rejected).toEqual([]);
    expect(read.lines[0]).toMatchObject({
      paperKey: 'card:old-card-1',
      licence: 'cc-by-sa',
      licenceUse: 'corpus',
    });
  });

  it('a broken envelope is refused whole (no lines, so no withdrawals run)', () => {
    expect(readEnvelope({ items: 'x' }).reject).toBe('envelope_invalid');
    expect(
      readEnvelope({
        generated_at: '2026-11-02T00:00:00Z',
        count: 2,
        items: [],
      }).reject,
    ).toBe('envelope_count_mismatch');
    expect(
      readEnvelope(fixture('statory-export.json'), '2026-11-02T18:30:00.000Z')
        .reject,
    ).toBe('envelope_stale');
  });

  it('line checks: wrong shapes are rejected per line, unknown keys are recorded', () => {
    const card = (id: string, extra: Record<string, unknown> = {}) => ({
      card_id: id,
      card_version: 'v4',
      title: 't',
      doi: '10.1/x',
      source_url: 'https://x',
      ...extra,
    });
    const env = readEnvelope({
      generated_at: '2026-11-02T00:00:00Z',
      items: [
        { card_id: 'c1' },
        card('c2', { source_url: 'http://x' }),
        card('c3', { year: 1800 }),
        card('c4', { authors: 'Kim' }),
        card('c5', { paper_id: 0 }),
        card('c6', { topic: 'harm' }),
        card('c7', { topics: ['crime'] }),
        card('c8', { statory_page_url: 'x' }),
        card('c9', { surprise: 1, topic: 'recovery' }),
        'not an object',
      ],
    });
    const read = readCardLines(env);
    expect(read.rejected.map((r) => r.reason)).toEqual([
      'card_version_missing',
      'source_url_invalid',
      'year_invalid',
      'authors_not_array',
      'paper_id_invalid',
      'cross_topic_unknown',
      'topic_unknown',
      'statory_page_url_invalid',
      'card_id_missing',
    ]);
    expect(read.lines).toHaveLength(1);
    expect(read.lines[0]).toMatchObject({
      topic: 'recovery',
      licence: 'unknown',
    });
    expect(read.unreceived).toEqual([
      { index: 8, key: 'surprise', why: 'unknown' },
    ]);
  });

  it('licence: six words, anything else reads as unknown (never widened)', () => {
    expect(licenceOf('cc-by', 'corpus')).toEqual({
      licence: 'cc-by',
      licenceUse: 'corpus',
    });
    expect(licenceOf('CC-BY', null).licence).toBe('unknown');
    expect(licenceOf(['cc-by'], null).licence).toBe('unknown');
    expect(licenceOf({ value: 'kogl-1', use: 'corpus' }, undefined)).toEqual({
      licence: 'kogl-1',
      licenceUse: 'corpus',
    });
  });
});

describe('받는 문 — 중독뉴스 export v0 (SOC-R15 ■4 · 계약 §7)', () => {
  it('Q12 shape: sourceType → grade, subtype ids, sourceEn kept; digital read as smartphone (SOC-R16 ■2)', () => {
    const page = readNewsPage(fixture('news-export-v0.json'))!;
    const read = readNewsLines([{ items: page.items, kind: 'article' }]);
    expect(read.lines.map((l) => l.slug)).toEqual([
      'addicted-news:article:5672',
      'addicted-news:broadcast:5873',
      'addicted-news:article:5700',
      'addicted-news:article:5701',
    ]);
    // 「게임·디지털」 = gaming · digital → gaming · smartphone(보낸 값은 payload 에 그대로)
    expect(read.lines[3].subtype).toEqual(['gaming', 'smartphone']);
    expect(read.lines[3].payload.subtype).toEqual(['gaming', 'digital']);
    expect(read.lines[3].payload).not.toHaveProperty('unknown_subtype');
    expect(read.lines[1]).toMatchObject({
      grade: 'broadcast',
      kind: 'broadcast',
      subtype: ['gambling'],
    });
    expect(read.lines[1].payload.sourceEn).toBe('MBC PD Notebook');
    // 「중독사회와 회복」 = topic recovery
    expect(read.lines[2].topic).toBe('recovery');
    expect(read.rejected).toEqual([{ index: 4, reason: 'title_missing' }]);
    expect(page.nextCursor).toBeNull();
  });

  it('old shape (no sourceType / subtype / sourceEn): grade from the pulled kind, subtype from the category table', () => {
    const page = readNewsPage(fixture('news-export-old.json'))!;
    expect(page.nextCursor).toBe('aWQ6NTYwMQ');
    const read = readNewsLines([{ items: page.items, kind: 'broadcast' }]);
    expect(read.lines.map((l) => [l.grade, l.subtype])).toEqual([
      ['broadcast', ['gambling']],
      ['broadcast', []], // 알코올·약물 = 분야 전체(넘겨짚지 않음)
    ]);
    // kind=all 로 당긴 옛 줄은 등급을 알 수 없다
    expect(readNewsLine(page.items[0], 'all').reject).toBe(
      'source_type_missing',
    );
  });

  it('wrong envelope → whole page refused; wrong lines → only that line; same id twice → one line', () => {
    const page = (extra: Record<string, unknown>) =>
      readNewsPage({ version: 'v0', field: 'addiction', items: [], ...extra });
    expect(page({ version: 'v1' })).toBeNull();
    expect(page({ field: 'x' })).toBeNull();
    expect(page({ items: undefined })).toBeNull();
    expect(page({ nextCursor: 3 })).toBeNull();
    expect(page({})).toEqual({ items: [], nextCursor: null });
    const ok = {
      id: 1,
      title: 't',
      sourceUrl: 'https://a',
      sourceType: 'kr_press',
    };
    const read = readNewsLines([
      {
        kind: 'article',
        items: [
          ok,
          { ...ok },
          { ...ok, id: '2' },
          { ...ok, id: 3, tier: 'archive' },
          { ...ok, id: 4, sourceUrl: 'ftp://x' },
        ],
      },
    ]);
    expect(read.lines).toHaveLength(1);
    expect(read.rejected.map((r) => r.reason)).toEqual([
      'id_invalid',
      'tier_not_publish',
      'source_url_invalid',
    ]);
  });
});

const at = (d: string) => new Date(`2026-11-0${d}T03:00:00Z`);
const stored = (id: number, p: Partial<StoredInbox> = {}): StoredInbox => ({
  id,
  slug: `statory:card:u${id}`,
  version: 'v4.0',
  paperKey: `paper:41`,
  upstream: 'public',
  reviewDecision: null,
  reviewedAt: null,
  keepFromVersion: null,
  keyMovedFrom: null,
  ...p,
});
const line = (
  cardId: string,
  version: string,
  paperKey: string,
): InboxLine => ({
  origin: 'statory',
  slug: `statory:card:${cardId}`,
  version,
  paperKey,
  cardId,
  title: 't',
  url: 'https://doi.org/10.1/x',
  grade: 'paper',
  kind: 'card',
  subtype: [],
  topic: null,
  licence: 'cc-by',
  licenceUse: 'corpus',
  missing: null,
  payload: { key_findings: ['f'] },
});

describe('승인 잇기 — 계획 planInbox (SOC-R15 ■1 · ■2 · ■4)', () => {
  it('everything new lands in the review queue (pending) unless the same paper has a human decision', () => {
    const plan = planInbox([], [line('u1', 'v4.0', 'paper:41')], true);
    expect(plan.insert[0].reviewDecision).toBeNull();
    expect(plan.insert[0].keepFromVersion).toBeNull();
  });

  it('new version of a kept paper inherits keep with keep_from_version; the old version is withdrawn', () => {
    const plan = planInbox(
      [stored(1, { reviewDecision: 'keep', reviewedAt: at('1') })],
      [line('u2', 'v4.1', 'paper:41')],
      true,
    );
    expect(plan.insert[0]).toMatchObject({
      reviewDecision: 'keep',
      keepFromVersion: 'v4.0',
      inheritedFrom: 'v4.0',
    });
    expect(plan.withdraw).toEqual([1]);
  });

  it('hide carries too; a broken (not full) pull never withdraws', () => {
    const plan = planInbox(
      [stored(1, { reviewDecision: 'hide', reviewedAt: at('1') })],
      [line('u2', 'v4.1', 'paper:41')],
      false,
    );
    expect(plan.insert[0].reviewDecision).toBe('hide');
    expect(plan.withdraw).toEqual([]);
  });

  it('the same version again: seen (idempotent), withdrawn → public again, human decision untouched', () => {
    const plan = planInbox(
      [
        stored(1, {
          slug: 'statory:card:u1',
          upstream: 'withdrawn',
          reviewDecision: 'keep',
          reviewedAt: at('1'),
        }),
      ],
      [line('u1', 'v4.0', 'paper:41')],
      true,
    );
    expect(plan.insert).toEqual([]);
    expect(plan.seen).toEqual([1]);
    expect(plan.republic).toEqual([1]);
    expect(plan.withdraw).toEqual([]);
  });

  it('C2: a line that now carries paper_id moves the old card-key decision onto the paper key once, then the next version inherits it', () => {
    const old = stored(1, {
      slug: 'statory:card:u1',
      paperKey: 'card:u1',
      reviewDecision: 'keep',
      reviewedAt: at('1'),
    });
    // 같은 판이 paper_id 를 달고 다시 옴 + 고친 새 판(다른 card_id)이 함께 옴
    const plan = planInbox(
      [old],
      [line('u1', 'v4.0', 'paper:41'), line('u2', 'v4.1', 'paper:41')],
      true,
    );
    expect(plan.keyMoves).toEqual([{ id: 1, from: 'card:u1', to: 'paper:41' }]);
    expect(plan.seen).toEqual([1]);
    expect(plan.insert).toHaveLength(1);
    expect(plan.insert[0]).toMatchObject({
      slug: 'statory:card:u2',
      reviewDecision: 'keep',
      keepFromVersion: 'v4.0',
    });
    // 한 번만 — 이미 옮긴 행(key_moved_from 있음)은 다시 옮기지 않음 · 옛 줄 지움 0
    const again = planInbox(
      [{ ...old, paperKey: 'paper:41', keyMovedFrom: 'card:u1' }],
      [line('u1', 'v4.0', 'paper:41')],
      true,
    );
    expect(again.keyMoves).toEqual([]);
  });

  it('review B1: a line rejected this round but still upstream is not withdrawn; an unknown-slug reject stops all withdrawals', () => {
    const kept = stored(1, {
      slug: 'statory:card:u1',
      reviewDecision: 'keep',
      reviewedAt: at('1'),
    });
    const other = stored(2, { slug: 'statory:card:u2', paperKey: 'paper:42' });
    const plan = planInbox(
      [kept, other],
      [],
      true,
      new Set(['statory:card:u1']),
    );
    expect(plan.withdraw).toEqual([2]);
    expect(planInbox([kept, other], [], true, null).withdraw).toEqual([]);
    // 실물 fixture: 거절 줄(겹친 paper_id · DOI 없음)의 slug 는 지켜진다(별칭 줄은 SOC-R16 ■2 부터 받음)
    const { read } = cardLines('statory-export.json');
    expect([...read.protect!].sort()).toEqual([
      'paper:item-41',
      'paper:item-45',
      'statory:card:6f1c0e2a-0000-4000-8000-000000000003',
      'statory:card:6f1c0e2a-0000-4000-8000-000000000005',
    ]);
    // 반박 1: 새 판(새 card_id)이 거절되면 앞 판 행(다른 slug · 같은 논문)도 지켜진다
    const v1 = stored(3, {
      slug: 'statory:card:old-v1',
      paperKey: 'paper:item-45',
      reviewDecision: 'keep',
      reviewedAt: at('1'),
    });
    expect(planInbox([v1], read.lines, true, read.protect).withdraw).toEqual(
      [],
    );
    const news = readNewsLines([
      {
        items: readNewsPage(fixture('news-export-v0.json'))!.items,
        kind: 'article',
      },
    ]);
    // 5701(digital)은 SOC-R16 ■2 부터 받는 줄 — 지킬 거절 줄은 5702(제목 없음)만
    expect(news.protect).toEqual(
      new Set(['addicted-news:article:5702', 'addicted-news:broadcast:5702']),
    );
    // id 가 없는 줄이 거절되면 지킬 것을 모름 → null
    expect(
      readNewsLines([{ items: [{}], kind: 'article' }]).protect,
    ).toBeNull();
  });

  it('review B3: a seen row gets its content refreshed (decision untouched)', () => {
    const plan = planInbox(
      [stored(1, { slug: 'statory:card:u1', reviewDecision: 'hide' })],
      [line('u1', 'v4.0', 'paper:41')],
      true,
    );
    expect(plan.refresh).toEqual([
      { id: 1, line: line('u1', 'v4.0', 'paper:41') },
    ]);
    expect(plan.insert).toEqual([]);
  });

  it('review 4: same paper and version under a new card_id inherits the human keep WITH the tag', () => {
    const plan = planInbox(
      [
        stored(1, {
          slug: 'statory:card:u1',
          reviewDecision: 'keep',
          reviewedAt: at('1'),
        }),
      ],
      [line('u1b', 'v4.0', 'paper:41')],
      true,
    );
    expect(plan.insert[0]).toMatchObject({
      reviewDecision: 'keep',
      keepFromVersion: 'v4.0',
    });
  });

  it('C2 without paper_id (old form) moves nothing; other papers never pass decisions across', () => {
    const old = stored(1, {
      paperKey: 'card:u1',
      reviewDecision: 'hide',
      reviewedAt: at('1'),
    });
    const plan = planInbox(
      [old],
      [line('u1', 'v4.0', 'card:u1'), line('u9', 'v1', 'paper:99')],
      true,
    );
    expect(plan.keyMoves).toEqual([]);
    expect(plan.insert[0]).toMatchObject({
      slug: 'statory:card:u9',
      reviewDecision: null,
    });
  });
});

const view = (p: Partial<InboxRowView> = {}): InboxRowView => ({
  id: 1,
  origin: 'statory',
  slug: 'statory:card:u2',
  version: 'v4.1',
  paperKey: 'paper:41',
  title: 't',
  url: 'https://doi.org/10.1/x',
  grade: 'paper',
  kind: 'card',
  subtype: [],
  topic: null,
  licence: 'cc-by',
  missing: null,
  upstream: 'public',
  reviewDecision: 'keep',
  reviewedBy: null,
  reviewedAt: null,
  keepFromVersion: 'v4.0',
  keyMovedFrom: null,
  payload: { key_findings: ['f'] },
  ...p,
});

describe('C1 — 이어받은 keep 은 손님에게 그대로 · 관리자에게만 꼬리표 (SOC-R15 ■1)', () => {
  it('guest: an inherited keep is shown exactly like a human keep, with no review fields or tag', () => {
    const inherited = guestView([view()]);
    const human = guestView([
      view({ keepFromVersion: null, reviewedAt: at('2'), reviewedBy: 'owner' }),
    ]);
    expect(inherited).toEqual(human);
    expect(inherited[0]).toEqual({
      slug: 'statory:card:u2',
      title: 't',
      url: 'https://doi.org/10.1/x',
      grade: 'paper',
      kind: 'card',
      subtype: [],
      topic: null,
      keyFindings: ['f'],
      sourceEn: null,
      source: null,
      quote: null,
    });
    expect(JSON.stringify(inherited)).not.toMatch(
      /keep_?[Ff]rom|이전 판|reviewed/,
    );
  });

  it('guest: only public ∧ keep; licence outside the four → title + link only', () => {
    expect(
      guestView([
        view({ reviewDecision: null }),
        view({ reviewDecision: 'hide' }),
        view({ upstream: 'withdrawn' }),
      ]),
    ).toEqual([]);
    expect(
      guestView([view({ licence: 'index-only' })])[0].keyFindings,
    ).toBeNull();
    expect(guestView([view({ licence: 'unknown' })])[0].keyFindings).toBeNull();
  });

  it('admin: the inherited keep carries the 「이전 판 승인」 tag with its version; a human keep does not', () => {
    expect(adminView(view()).inheritedKeep).toEqual({
      label: INHERITED_KEEP_LABEL,
      fromVersion: 'v4.0',
    });
    expect(INHERITED_KEEP_LABEL).toBe('이전 판 승인');
    expect(adminView(view({ keepFromVersion: null })).inheritedKeep).toBeNull();
    expect(adminView(view()).guestVisible).toBe(true);
    expect(adminTabOf(view())).toBe('keep');
    expect(adminTabOf(view({ reviewDecision: null }))).toBe('pending');
    expect(adminTabOf(view({ upstream: 'withdrawn' }))).toBe('withdrawn');
  });
});

describe('스위치 — 꺼 둔다 (SOC-R15 ■4)', () => {
  it('off unless ECO_LINK1_INBOX_ENABLED is exactly "true"', () => {
    expect(ecoInboxEnabled({})).toBe(false);
    expect(ecoInboxEnabled({ ECO_LINK1_INBOX_ENABLED: 'false' })).toBe(false);
    expect(ecoInboxEnabled({ ECO_LINK1_INBOX_ENABLED: '1' })).toBe(false);
    expect(ecoInboxEnabled({ ECO_LINK1_INBOX_ENABLED: ' true' })).toBe(false);
    expect(ecoInboxEnabled({ ECO_LINK1_INBOX_ENABLED: 'true\n' })).toBe(false);
    expect(ecoInboxEnabled({ ECO_LINK1_INBOX_ENABLED: 'true' })).toBe(true);
  });

  it('off: the nightly nine steps stay as they are; on: import:eco runs just before refresh:home', () => {
    expect(dailySteps({})).toBe(DAILY_STEPS);
    expect(DAILY_STEPS.map((s) => s.name)).not.toContain('import:eco');
    const on = dailySteps({ ECO_LINK1_INBOX_ENABLED: 'true' });
    expect(on).toHaveLength(10);
    expect(on[8]).toEqual(ECO_IMPORT_STEP);
    expect(on[9].name).toBe('refresh:home');
  });

  it('the step has an npm script of the same name', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['import:eco']).toBe(
      `ts-node src/${ECO_IMPORT_STEP.entry}.ts`,
    );
  });
});

describe('migration eco_inbox (SOC-R15 ■4)', () => {
  it('creates one new table + index only (no change to existing tables, no fill)', async () => {
    const sql: string[] = [];
    await new CreateEcoInbox1789000000000().up({
      query: (q: string) => (sql.push(q), Promise.resolve([])),
    } as unknown as QueryRunner);
    expect(sql).toHaveLength(2);
    expect(sql[0]).toMatch(/^\s*CREATE TABLE IF NOT EXISTS "eco_inbox"/);
    expect(sql[0]).toContain(
      'CONSTRAINT "UQ_eco_inbox_origin_slug_version" UNIQUE ("origin", "slug", "version")',
    );
    for (const col of [
      '"paper_key" text NOT NULL',
      '"keep_from_version" text NULL',
      '"key_moved_from" text NULL',
      '"key_moved_at" timestamptz NULL',
      '"review_decision" text NULL',
      `"upstream" text NOT NULL DEFAULT 'public'`,
    ]) {
      expect(sql[0]).toContain(col);
    }
    expect(sql[1]).toBe(
      'CREATE INDEX IF NOT EXISTS "IDX_eco_inbox_paper_key" ON "eco_inbox" ("origin", "paper_key")',
    );
    expect(sql.join('\n')).not.toMatch(/ALTER|DROP|DELETE|UPDATE|INSERT/);
    const down: string[] = [];
    await new CreateEcoInbox1789000000000().down({
      query: (q: string) => (down.push(q), Promise.resolve([])),
    } as unknown as QueryRunner);
    expect(down).toEqual([
      'DROP INDEX IF EXISTS "IDX_eco_inbox_paper_key"',
      'DROP TABLE IF EXISTS "eco_inbox"',
    ]);
  });
});
