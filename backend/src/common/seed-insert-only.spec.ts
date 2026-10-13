import { readFileSync } from 'fs';
import { join } from 'path';
import type { Repository } from 'typeorm';
import { diffFields, SeedInsertOnly } from './seed-insert-only';

// SOC-R2 ■3 — 매일 예약 seed 가 기존 행(관리자 손·감시 크론 갱신)을 덮지 않는다.

type Row = {
  id: number;
  name: string;
  phone?: string | null;
  updatedAt?: Date;
};

function fakeRepo(rows: Row[]) {
  const calls = { save: 0, update: 0, upsert: 0 };
  const repo = {
    findOne: jest.fn(({ where }: { where: Partial<Row> }) =>
      Promise.resolve(rows.find((r) => r.name === where.name) ?? null),
    ),
    create: jest.fn((r: Partial<Row>) => ({ ...r }) as Row),
    save: jest.fn((r: Row) => {
      calls.save++;
      const saved = { ...r, id: rows.length + 1 };
      rows.push(saved);
      return Promise.resolve(saved);
    }),
    update: jest.fn(() => {
      calls.update++;
      return Promise.resolve();
    }),
    upsert: jest.fn(() => {
      calls.upsert++;
      return Promise.resolve();
    }),
  };
  return { repo: repo as unknown as Repository<Row>, calls };
}

describe('SeedInsertOnly', () => {
  it('inserts a row that does not exist', async () => {
    const { repo, calls } = fakeRepo([]);
    const seed = new SeedInsertOnly('recovery_resources');
    const r = await seed.insertOnly(repo, { name: 'A' }, { name: 'A' }, 'A');
    expect(r.result).toBe('inserted');
    expect(calls.save).toBe(1);
    expect(seed.inserted).toBe(1);
  });

  it('never writes an existing row — an admin edit survives', async () => {
    const edited = {
      id: 7,
      name: 'A',
      phone: '02-000-0000', // 관리자가 고친 값
      updatedAt: new Date('2026-10-12T03:00:00Z'),
    };
    const { repo, calls } = fakeRepo([edited]);
    const seed = new SeedInsertOnly('recovery_resources');
    const r = await seed.insertOnly(
      repo,
      { name: 'A' },
      { name: 'A', phone: '02-111-1111' },
      'A',
    );
    expect(r.result).toBe('skipped');
    expect(r.entity).toBe(edited);
    expect(calls).toEqual({ save: 0, update: 0, upsert: 0 });
    expect(edited.phone).toBe('02-000-0000');
    expect(edited.updatedAt.toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('records a differing value as seed_diff only', async () => {
    const { repo } = fakeRepo([{ id: 1, name: 'A', phone: 'x' }]);
    const seed = new SeedInsertOnly('recovery_resources');
    await seed.insertOnly(repo, { name: 'A' }, { name: 'A', phone: 'y' }, 'A');
    expect(seed.diffs).toEqual([
      {
        table: 'recovery_resources',
        key: 'A',
        field: 'phone',
        db: 'x',
        seed: 'y',
      },
    ]);
    expect(seed.lines()[0]).toMatch(/신규 0 · 기존 건너뜀 1 · 다른 값 1건/);
  });

  it('same values produce no diff', async () => {
    const { repo } = fakeRepo([{ id: 1, name: 'A', phone: 'x' }]);
    const seed = new SeedInsertOnly('t');
    await seed.insertOnly(repo, { name: 'A' }, { name: 'A', phone: 'x' }, 'A');
    expect(seed.diffs).toHaveLength(0);
  });
});

describe('diffFields normalisation', () => {
  it('treats numeric strings, undefined/null, key order and date strings as equal', () => {
    expect(
      diffFields(
        {
          value: '4.80',
          unit: null,
          detail: { b: 1, a: [1, 2] },
          day: new Date('2026-03-27T00:00:00Z'),
        },
        {
          value: '4.8',
          unit: undefined,
          detail: { a: [1, 2], b: 1 },
          day: '2026-03-27',
        },
      ),
    ).toEqual([]);
  });

  it('only compares keys the seed owns and honours ignore', () => {
    expect(
      diffFields(
        { a: 1, extra: 'db only', fetchedAt: 'old' },
        { a: 2, fetchedAt: 'new' },
        ['fetchedAt'],
      ),
    ).toEqual([{ field: 'a', db: 1, seed: 2 }]);
  });
});

describe('daily seed scripts are insert-only (static)', () => {
  const files = [
    'sources/seed/sources.seed.ts',
    'recovery/seed/recovery.seed.ts',
    'policy/seed/documents.seed.ts',
    'indicators/seed/collect-indicators.ts',
  ];
  it.each(files)('%s has no update/upsert on existing rows', (f) => {
    const src = readFileSync(join(__dirname, '..', f), 'utf8');
    expect(src).not.toMatch(
      /\.update\(|\.upsert\(|createQueryBuilder\(\)\s*\.update/,
    );
    expect(src).toMatch(/SeedInsertOnly/);
  });
});
