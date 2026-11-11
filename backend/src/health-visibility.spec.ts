import { IsNull, type DataSource } from 'typeorm';
import { BroadcastItem } from './sources/entities/broadcast-item.entity';
import { EcoInboxItem } from './evidence/entities/eco-inbox.entity';
import { Research } from './research/entities/research.entity';
import { visibilityCounts } from './health-visibility';

// SOC-R23 ■3 — 숨김 · 보관 수: COUNT 만 · 칸마다 실패하면 null · 쓰기 0.
type Where = Record<string, unknown> | undefined;

function fakeDs(
  counts: Map<unknown, (where: Where) => number>,
  calls: Array<[string, Where]>,
): DataSource {
  return {
    getRepository: (entity: { name: string }) => {
      const f = counts.get(entity);
      return {
        count: (opts?: { where?: Where }) => {
          calls.push([entity.name, opts?.where]);
          if (!f) return Promise.reject(new Error('relation does not exist'));
          return Promise.resolve(f(opts?.where));
        },
        // 쓰기 길은 없어야 한다
        save: () => {
          throw new Error('write');
        },
      };
    },
  } as unknown as DataSource;
}

describe('visibilityCounts (SOC-R23 ■3)', () => {
  it('counts hidden research, archived/hidden broadcasts and eco rows with count queries only', async () => {
    const calls: Array<[string, Where]> = [];
    const ds = fakeDs(
      new Map<unknown, (w: Where) => number>([
        [Research, (w) => (w?.reviewDecision === 'hide' ? 4 : 120)],
        [
          BroadcastItem,
          (w) => {
            if (!w) return 62;
            if (w.hiddenReason === 'source_archived') return 38;
            return 21; // IsNull()
          },
        ],
        [EcoInboxItem, () => 0], // 받는 문은 꺼진 채 — 0 행
      ]),
      calls,
    );
    const got = await visibilityCounts(ds);
    expect(got).toEqual({
      research: { approved: 120, hidden: 4 },
      broadcasts: { total: 62, visible: 21, archived: 38, hidden: 3 },
      eco: { total: 0, hidden: 0, withdrawn: 0 },
    });
    expect(calls).toContainEqual([
      'Research',
      { status: 'approved', reviewDecision: 'hide' },
    ]);
    expect(calls).toContainEqual(['BroadcastItem', { hiddenReason: IsNull() }]);
    expect(calls).toContainEqual(['EcoInboxItem', { upstream: 'withdrawn' }]);
  });

  it('a failing table gives null for that section only', async () => {
    const ds = fakeDs(
      new Map<unknown, (w: Where) => number>([[Research, () => 1]]),
      [],
    );
    const got = await visibilityCounts(ds);
    expect(got.research).toEqual({ approved: 1, hidden: 1 });
    expect(got.broadcasts).toBeNull();
    expect(got.eco).toBeNull();
  });
});
