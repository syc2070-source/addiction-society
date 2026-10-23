import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner } from 'typeorm';
import { BroadcastSourceEnAndHidden1788800000000 } from '../migrations/1788800000000-BroadcastSourceEnAndHidden';
import { BROADCAST_SOURCE_EN } from './broadcast-names';
import {
  archiveDecision,
  BROADCAST_FETCH_LIMIT,
  SOURCE_ARCHIVED,
  sourceEnOf,
  toBroadcastRows,
  type StoredBroadcast,
} from './broadcast.util';
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

  it('canon table = the front table (broadcaster + programme) for all 9 channels', () => {
    const front = readFileSync(
      join(__dirname, '../../../frontend-next/src/lib/broadcastNamesEn.ts'),
      'utf8',
    );
    const entries = [
      ...front.matchAll(
        /'?([^'\n]+?)'?: \{\s*outletId: '[^']+',\s*broadcaster: '([^']+)',\s*program: '([^']+)'/g,
      ),
    ].map((m) => {
      // 프로그램 이름이 방송사를 이미 품으면(SBS Special · Newstapa) 그대로
      const [, key, who, prog] = m;
      const whole =
        prog === who || prog.startsWith(`${who} `) ? prog : `${who} ${prog}`;
      return [key.trim(), whole];
    });
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
