import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner, Repository } from 'typeorm';
import { RestoreSkippedExpectedMonth1788700000001 } from '../migrations/1788700000001-RestoreSkippedExpectedMonth';
import { SeedInsertOnly } from '../common/seed-insert-only';
import { backfillPlan, computeNextExpected } from './next-expected.util';
import { EXPECTED_RESTORES_R8 } from './expected-restore';
import { missedReleases } from './missed-releases';
import type { Source } from './entities/source.entity';

/** SOC-R8 ■2 — 이번 달 예정은 그 달이 끝나기 전엔 밀리지 않는다. */

const kst = (s: string) => new Date(`${s}+09:00`);

// 운영 drugfree_stats 꼴(10-18 실측: 월간 · 마지막 발간 2026-03-09)
const drugfree = {
  id: 'drugfree_stats',
  titleKo: '마약류 통계',
  titleEn: 'Drug Statistics',
  orgKo: '한국마약퇴치운동본부',
  org: '마약퇴치운동본부',
  url: 'https://www.drugfree.or.kr/portal/kor/M467848284/board.do',
  accessMethod: 'html',
  status: 'active',
  cadence: 'monthly',
  expectedMonth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  lastPublishedAt: '2026-03-09',
  nextExpectedAt: '2026-10-01',
} as unknown as Source;

describe('SOC-R8 ■2 roll-over rule', () => {
  it('inside the month the expected month stays put (the old daily recompute pushed it to November)', () => {
    // 옛 길: 「오늘 이후 첫 달」로 다시 계산 → 10월 중순에 11-01 (사건 없음)
    expect(computeNextExpected(drugfree, kst('2026-10-18T04:00:00'))).toBe(
      '2026-11-01',
    );
    // 새 길: 달 안에서는 쓰지 않음
    for (const at of [
      '2026-10-03T04:00:00',
      '2026-10-18T04:00:00',
      '2026-10-31T23:00:00',
      '2026-11-01T04:00:00', // 04:00 KST = 10-31 UTC — 아직 10월(월 판정은 UTC)
    ]) {
      expect(backfillPlan(drugfree, kst(at))).toBeNull();
    }
    const src = readFileSync(
      join(__dirname, 'seed', 'backfill-next.ts'),
      'utf8',
    );
    expect(src).toContain('backfillPlan(s, today)');
    expect(src).not.toContain('computeNextExpected(s, today)');
  });

  it('after the month ends it rolls once with rescheduled; an empty value is filled without an event', () => {
    expect(backfillPlan(drugfree, kst('2026-11-01T09:00:00'))).toEqual({
      to: '2026-11-01',
      rolled: true,
    });
    expect(
      backfillPlan(
        { ...drugfree, nextExpectedAt: null },
        kst('2026-10-18T04:00:00'),
      ),
    ).toEqual({ to: '2026-11-01', rolled: false });
    // 주기 없음(irregular) · 빈 값 → 지어내지 않음
    expect(
      backfillPlan(
        { ...drugfree, cadence: 'irregular', nextExpectedAt: null },
        kst('2026-10-18T04:00:00'),
      ),
    ).toBeNull();
  });

  it('on 11-01 the 09:00 read then roll gives a 「2026-10 · not published」 row', () => {
    const after = { ...drugfree, nextExpectedAt: '2026-11-01' } as Source;
    const rows = missedReleases(
      [after],
      [
        {
          sourceId: 'drugfree_stats',
          eventType: 'checked',
          detectedAt: '2026-11-01T00:00:05Z',
          detail: { method: 'board-latest' },
        },
        {
          sourceId: 'drugfree_stats',
          eventType: 'rescheduled',
          detectedAt: '2026-11-01T00:00:30Z',
          detail: {
            from: '2026-10-01',
            to: '2026-11-01',
            reason: 'overdue',
            publicationConfirmed: false,
          },
        },
        // 되돌리기 사건은 줄이 되지 않는다
        {
          sourceId: 'drugfree_stats',
          eventType: 'rescheduled',
          detectedAt: '2026-10-18T06:00:00Z',
          detail: { from: '2026-11-01', to: '2026-10-01', reason: 'restore' },
        },
      ],
      kst('2026-11-01T10:00:00'),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        sourceId: 'drugfree_stats',
        expected: '2026-10',
        next: '2026-11',
        action: 'rolled',
        monitor: 'not_published',
      }),
    ]);
  });

  it('seed:sources never writes next_expected_at on an existing row', async () => {
    const src = readFileSync(
      join(__dirname, 'seed', 'sources.seed.ts'),
      'utf8',
    );
    expect(src).toContain('{ ...row, nextExpectedAt: null }');
    expect(src).toContain("['nextExpectedAt']");
    const saves: unknown[] = [];
    const repo = {
      findOne: () => Promise.resolve({ ...drugfree }),
      save: (r: unknown) => (saves.push(r), Promise.resolve(r)),
      create: (r: unknown) => r,
    } as unknown as Repository<Source>;
    const seed = new SeedInsertOnly('sources');
    const res = await seed.insertOnly(
      repo,
      { id: 'drugfree_stats' },
      { ...drugfree, nextExpectedAt: null },
      'drugfree_stats',
      ['nextExpectedAt'],
    );
    expect(res.result).toBe('skipped');
    expect(saves).toHaveLength(0);
    expect(seed.diffs).toEqual([]);
  });

  it('restores the two silently pushed October months once, each with rescheduled{reason:restore}', async () => {
    expect(EXPECTED_RESTORES_R8.map((r) => [r.id, r.from, r.to])).toEqual([
      ['drugfree_stats', '2026-11-01', '2026-10-01'],
      ['spo_drug_monthly', '2026-11-01', '2026-10-01'],
    ]);
    const run = async (matched: number[]) => {
      const sql: { q: string; p: unknown[] }[] = [];
      let i = 0;
      const runner = {
        query: (q: string, p: unknown[]) => {
          sql.push({ q, p });
          if (q.startsWith('UPDATE')) {
            const n = matched[i++] ?? 0;
            return Promise.resolve([Array.from({ length: n }, () => ({})), n]);
          }
          return Promise.resolve([]);
        },
      } as unknown as QueryRunner;
      await new RestoreSkippedExpectedMonth1788700000001().up(runner);
      return sql;
    };
    const first = await run([1, 1]);
    const updates = first.filter((s) => s.q.startsWith('UPDATE'));
    const inserts = first.filter((s) => s.q.startsWith('INSERT'));
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.q).toContain('UPDATE sources SET next_expected_at = $2');
      expect(u.q).toContain('next_expected_at = $3'); // 아직 11-01 일 때만
      expect(u.q).toContain('last_published_at < $2'); // 10월 발간을 잡았으면 그대로
      expect(u.q).not.toMatch(/observations|indicators|documents/);
    }
    expect(inserts).toHaveLength(2);
    expect(inserts[0].q).toContain("'rescheduled'");
    expect(JSON.parse(inserts[0].p[1] as string)).toMatchObject({
      from: '2026-11-01',
      to: '2026-10-01',
      reason: 'restore',
      by: 'SOC-R8',
    });
    // 다시 돌리면(이미 10-01) 사건 0
    const again = await run([0, 0]);
    expect(again.filter((s) => s.q.startsWith('INSERT'))).toHaveLength(0);

    // 되돌린 뒤 남은 10월 동안 04:00 backfill 은 그대로 둔다
    const spo = {
      ...drugfree,
      id: 'spo_drug_monthly',
      lastPublishedAt: '2026-09-30',
      nextExpectedAt: '2026-10-01',
    } as Source;
    expect(backfillPlan(spo, kst('2026-10-19T04:00:00'))).toBeNull();
    expect(backfillPlan(drugfree, kst('2026-10-19T04:00:00'))).toBeNull();
  });
});
