import { type DataSource } from 'typeorm';
import { BroadcastItem } from './sources/entities/broadcast-item.entity';
import { EcoInboxItem } from './evidence/entities/eco-inbox.entity';
import { Research } from './research/entities/research.entity';
import { broadcastBuckets, visibilityCounts } from './health-visibility';

// SOC-R23 ■3 — 숨김 · 보관 수: COUNT 만 · 칸마다 실패하면 null · 쓰기 0.
type Where = Record<string, unknown> | undefined;
type Raw = Array<{ reason: string | null; n: string }>;

function fakeDs(
  counts: Map<unknown, (where: Where) => number>,
  grouped: Raw | null,
  calls: Array<[string, Where]>,
): DataSource {
  return {
    getRepository: (entity: { name: string }) => {
      const f = counts.get(entity);
      const qb = {
        select: () => qb,
        addSelect: () => qb,
        groupBy: () => qb,
        getRawMany: () =>
          grouped && entity === BroadcastItem
            ? Promise.resolve(grouped)
            : Promise.reject(new Error('relation does not exist')),
      };
      return {
        count: (opts?: { where?: Where }) => {
          calls.push([entity.name, opts?.where]);
          if (!f) return Promise.reject(new Error('relation does not exist'));
          return Promise.resolve(f(opts?.where));
        },
        createQueryBuilder: () => qb,
        // 쓰기 길은 없어야 한다
        save: () => {
          throw new Error('write');
        },
      };
    },
  } as unknown as DataSource;
}

describe('visibilityCounts (SOC-R23 ■3)', () => {
  it('counts hidden research, broadcast buckets in one grouped query, and eco rows', async () => {
    const calls: Array<[string, Where]> = [];
    const ds = fakeDs(
      new Map<unknown, (w: Where) => number>([
        [Research, (w) => (w?.reviewDecision === 'hide' ? 4 : 120)],
        [EcoInboxItem, () => 0], // 받는 문은 꺼진 채 — 0 행
      ]),
      [
        { reason: null, n: '21' },
        { reason: 'source_archived', n: '38' },
        { reason: 'source_unlisted', n: '2' },
        { reason: 'source_deleted', n: '1' },
      ],
      calls,
    );
    const got = await visibilityCounts(ds);
    expect(got).toEqual({
      research: { approved: 120, hidden: 4 },
      broadcasts: {
        total: 62,
        visible: 21,
        archived: 38,
        removed: 3,
        hidden: 0,
      },
      eco: { total: 0, hidden: 0, withdrawn: 0 },
    });
    expect(calls).toContainEqual([
      'Research',
      { status: 'approved', reviewDecision: 'hide' },
    ]);
    expect(calls).toContainEqual(['EcoInboxItem', { upstream: 'withdrawn' }]);
  });

  it('a reason that is not a source reason counts as hidden (a person or another path hid it)', () => {
    expect(
      broadcastBuckets([
        { reason: null, n: 5 },
        { reason: 'manual', n: '2' },
      ]),
    ).toEqual({ total: 7, visible: 5, archived: 0, removed: 0, hidden: 2 });
  });

  it('a failing table gives null for that section only', async () => {
    const ds = fakeDs(
      new Map<unknown, (w: Where) => number>([[Research, () => 1]]),
      null,
      [],
    );
    const got = await visibilityCounts(ds);
    expect(got.research).toEqual({ approved: 1, hidden: 1 });
    expect(got.broadcasts).toBeNull();
    expect(got.eco).toBeNull();
  });
});
