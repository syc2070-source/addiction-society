import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Repository } from 'typeorm';
import type { EcoInboxItem } from './entities/eco-inbox.entity';
import { EcoInboxService, ReviewEcoDto } from './eco-inbox.service';

/** SOC-R15 리뷰 1 · 2 · 5 — 사람 결정은 결정 칸만 쓰고, 같은 열쇠의 물려받은 판도 맞춘다 */
describe('EcoInboxService.review', () => {
  const row = {
    id: 7,
    origin: 'statory',
    slug: 'statory:card:u2',
    version: 'v4.1',
    paperKey: 'paper:41',
    upstream: 'public',
    reviewDecision: 'keep',
    keepFromVersion: 'v4.0',
    payload: {},
    subtype: [],
  } as unknown as EcoInboxItem;

  function setup() {
    const updates: unknown[][] = [];
    const queries: { q: string; p: unknown[] }[] = [];
    const repo = {
      findOne: jest.fn().mockResolvedValue(row),
      update: jest.fn((id: number, v: unknown) => {
        updates.push([id, v]);
        return Promise.resolve({});
      }),
      findOneOrFail: jest.fn().mockResolvedValue(row),
      save: jest.fn(),
    };
    const manager = {
      getRepository: () => repo,
      query: (q: string, p: unknown[]) => {
        queries.push({ q, p });
        return Promise.resolve([]);
      },
    };
    const outer = {
      manager: {
        transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
      },
    } as unknown as Repository<EcoInboxItem>;
    return { svc: new EcoInboxService(outer), repo, updates, queries };
  }

  it('writes only the decision columns (never save() of a stale row) and clears the tag', async () => {
    const { svc, repo, updates } = setup();
    await svc.review(7, 'hide', 'owner@x');
    expect(repo.save).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(updates[0][0]).toBe(7);
    expect(Object.keys(updates[0][1] as object).sort()).toEqual([
      'keepFromVersion',
      'reviewDecision',
      'reviewedAt',
      'reviewedBy',
    ]);
    expect(updates[0][1]).toMatchObject({
      reviewDecision: 'hide',
      keepFromVersion: null,
    });
  });

  it('same-key rows holding only an inherited value follow the new human decision (keep → tag = this version)', async () => {
    const { svc, queries } = setup();
    await svc.review(7, 'keep', 'owner@x');
    // 반박 2: 같은 열쇠의 행을 id 차례로 먼저 잠근다 → 그다음 물려받은 판을 맞춘다
    expect(queries).toHaveLength(2);
    expect(queries[0].q).toMatch(/ORDER BY "id" FOR UPDATE$/);
    expect(queries[0].p).toEqual(['statory', 'paper:41']);
    expect(queries[1].q).toContain('"reviewed_at" IS NULL');
    expect(queries[1].q).not.toMatch(/DELETE/);
    expect(queries[1].p).toEqual(['statory', 'paper:41', 'keep', 'v4.1', 7]);
    const hide = setup();
    await hide.svc.review(7, 'hide', 'owner@x');
    expect(hide.queries[1].p).toEqual(['statory', 'paper:41', 'hide', null, 7]);
  });

  it('review 5: the decision key must be present — {} or a typo is 400, explicit null (reset) is fine', () => {
    const errs = (body: object) =>
      validateSync(plainToInstance(ReviewEcoDto, body)).length;
    expect(errs({})).toBeGreaterThan(0);
    expect(errs({ decison: 'hide' })).toBeGreaterThan(0);
    expect(errs({ decision: 'maybe' })).toBeGreaterThan(0);
    expect(errs({ decision: null })).toBe(0);
    expect(errs({ decision: 'keep' })).toBe(0);
    expect(errs({ decision: 'hide' })).toBe(0);
  });
});
