import { SourcesScheduler } from './sources.scheduler';
import { Source } from './entities/source.entity';
import { SourcesNotifier } from './discord.notifier';
import { SourceEventsService } from './source-events.service';
import type { Repository } from 'typeorm';
import type { RecordEventInput } from './source-events.service';

/**
 * reconcileExpected 테스트 (AS-M3-FIX-DATE) — DB 없이 저장소를 가짜로 세운다.
 * 확인 사항: 지난 예정일만 골라 이월하고, 이월 사실을 원장에 남긴다.
 */

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

function src(over: Partial<Source>): Source {
  return {
    id: 'x',
    cadence: 'annual',
    expectedMonth: [7],
    lastPublishedAt: null,
    nextExpectedAt: null,
    status: 'active',
    ...over,
  } as Source;
}

/** nextExpectedAt < cutoff 인 행만 돌려주는 최소 QueryBuilder 흉내 */
function fakeRepo(rows: Source[]) {
  const updates: { id: string; next: string | null }[] = [];
  let cutoff = '';
  const qb = {
    where: () => qb,
    andWhere: (_sql: string, params?: Record<string, string>) => {
      if (params?.cutoff) cutoff = params.cutoff;
      return qb;
    },
    getMany: () =>
      Promise.resolve(
        rows.filter((r) => r.nextExpectedAt && r.nextExpectedAt < cutoff),
      ),
  };
  const repo = {
    createQueryBuilder: () => qb,
    update: (id: string, patch: Partial<Source>) => {
      updates.push({ id, next: patch.nextExpectedAt ?? null });
      return Promise.resolve({ affected: 1 });
    },
  } as unknown as Repository<Source>;
  return { repo, updates };
}

function fakeEvents() {
  const recorded: RecordEventInput[] = [];
  const events = {
    record: (input: RecordEventInput) => {
      recorded.push(input);
      return Promise.resolve();
    },
  } as unknown as SourceEventsService;
  return { events, recorded };
}

describe('SourcesScheduler.reconcileExpected', () => {
  const notifier = {} as SourcesNotifier;

  it('지난 예정일을 다음 주기로 이월하고 원장에 남긴다', async () => {
    const rows = [
      // 버그 재현: 2026-07 예정이 8월까지 남아 있던 SAMHSA NSDUH
      src({ id: 'samhsa_nsduh', nextExpectedAt: '2026-07-01' }),
      // 이번 달 예정 — 건드리지 않는다
      src({
        id: 'this_month',
        expectedMonth: [8],
        nextExpectedAt: '2026-08-01',
      }),
      // 미래 예정 — 건드리지 않는다
      src({ id: 'future', expectedMonth: [11], nextExpectedAt: '2026-11-01' }),
    ];
    const { repo, updates } = fakeRepo(rows);
    const { events, recorded } = fakeEvents();
    const sched = new SourcesScheduler(repo, notifier, events);

    const rolled = await sched.reconcileExpected(at('2026-08-02'));

    expect(rolled).toEqual([
      { id: 'samhsa_nsduh', from: '2026-07-01', to: '2027-07-01' },
    ]);
    expect(updates).toEqual([{ id: 'samhsa_nsduh', next: '2027-07-01' }]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].eventType).toBe('rescheduled');
    expect(recorded[0].detail).toMatchObject({
      from: '2026-07-01',
      to: '2027-07-01',
      reason: 'overdue',
      publicationConfirmed: false,
    });
  });

  it('예정 월이 없으면 미정(null)으로 이월한다', async () => {
    const rows = [
      src({
        id: 'no_month',
        expectedMonth: null,
        nextExpectedAt: '2026-05-01',
      }),
    ];
    const { repo, updates } = fakeRepo(rows);
    const { events, recorded } = fakeEvents();
    const sched = new SourcesScheduler(repo, notifier, events);

    const rolled = await sched.reconcileExpected(at('2026-08-02'));

    expect(rolled).toEqual([{ id: 'no_month', from: '2026-05-01', to: null }]);
    expect(updates).toEqual([{ id: 'no_month', next: null }]);
    expect(recorded).toHaveLength(1);
  });

  it('이월할 것이 없으면 아무것도 쓰지 않는다', async () => {
    const rows = [src({ id: 'future', nextExpectedAt: '2027-07-01' })];
    const { repo, updates } = fakeRepo(rows);
    const { events, recorded } = fakeEvents();
    const sched = new SourcesScheduler(repo, notifier, events);

    expect(await sched.reconcileExpected(at('2026-08-02'))).toEqual([]);
    expect(updates).toEqual([]);
    expect(recorded).toEqual([]);
  });
});
