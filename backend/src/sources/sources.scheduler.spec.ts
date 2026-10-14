import {
  DAILY_DUE_WHERE,
  isDailyDue,
  MONITORED_STATUSES,
  SourcesScheduler,
} from './sources.scheduler';
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

  // SOC-R4 ■2 — stale 은 막다른 길이 아니다: 다시 읽고, 읽히면 active 로 돌아온다.
  it('a stale source is read again, retried once, and comes back active', async () => {
    const patches: { id: string; patch: Partial<Source> }[] = [];
    const repo = {
      update: (id: string, patch: Partial<Source>) => {
        patches.push({ id, patch });
        return Promise.resolve({ affected: 1 });
      },
    } as unknown as Repository<Source>;
    const { events, recorded } = fakeEvents();
    const sched = new SourcesScheduler(repo, notifier, events);
    const s = sched as unknown as {
      sleep: (ms: number) => Promise<void>;
      detectChange: (s: Source) => Promise<unknown>;
    };
    const sleeps: number[] = [];
    s.sleep = (ms) => (sleeps.push(ms), Promise.resolve());
    let calls = 0;
    s.detectChange = () =>
      ++calls === 1
        ? Promise.reject(new Error('fetch failed'))
        : Promise.resolve({
            changed: false,
            method: 'board-latest',
            update: {},
          });

    const drugfree = src({
      id: 'drugfree_stats',
      status: 'stale',
      failCount: 3,
      accessMethod: 'html',
    });
    const res = await sched.monitorSources([drugfree]);

    expect(MONITORED_STATUSES).toContain('stale');
    expect(calls).toBe(2);
    expect(sleeps).toEqual([5000]);
    expect(res).toEqual([
      { id: 'drugfree_stats', status: 'unchanged', method: 'board-latest' },
    ]);
    expect(patches[0].patch).toMatchObject({ failCount: 0, status: 'active' });
    expect(recorded[0]).toMatchObject({
      eventType: 'checked',
      detail: { method: 'board-latest', recoveredFrom: 'stale' },
    });

    // 두 번 다 실패해야 연속 실패 1회 — stale 그대로, failCount 4
    calls = 0;
    s.detectChange = () => Promise.reject(new Error('fetch failed'));
    patches.length = 0;
    const again = await sched.monitorSources([drugfree]);
    expect(again[0]).toMatchObject({ status: 'stale', failCount: 4 });
    expect(patches[0].patch).toMatchObject({ failCount: 4, status: 'stale' });
  });

  // SOC-R5 ■2 — 한 번도 읽지 않은 소스는 다음 예정과 무관하게 첫 읽기 1회.
  it('a never-read source joins the daily run once, whatever its next date', async () => {
    const hz = '2026-11-14'; // 10-15 + 30일
    const rows = [
      // 10-15 실측: 다음 예정 30일 넘음 · lastCheckedAt null → 전에는 영영 빠짐
      src({ id: 'who_whs', nextExpectedAt: '2027-05-01', lastCheckedAt: null }),
      // 예정일 규칙으로 이미 대상
      src({
        id: 'drugfree_stats',
        nextExpectedAt: '2026-11-01',
        lastCheckedAt: at('2026-10-14'),
      }),
      // 읽어 봤고 예정이 멀다 → 빠짐
      src({
        id: 'unodc_wdr',
        nextExpectedAt: '2027-06-01',
        lastCheckedAt: at('2026-10-15'),
      }),
      // 첫 읽기가 실패했어도 lastCheckedAt 이 채워져 다시 끼지 않는다
      src({
        id: 'euda_edr',
        nextExpectedAt: '2027-06-01',
        lastCheckedAt: at('2026-10-15'),
        failCount: 1,
      }),
    ];
    expect(rows.filter((r) => isDailyDue(r, hz)).map((r) => r.id)).toEqual([
      'who_whs',
      'drugfree_stats',
    ]);
    expect(DAILY_DUE_WHERE).toContain('s.lastCheckedAt IS NULL');

    // 크론이 그 조건을 그대로 쓰는지(가짜 QueryBuilder 가 SQL 을 받아 같은 판정)
    const seen: string[] = [];
    const qb = {
      where: () => qb,
      andWhere: (sql: string, params?: Record<string, string>) => {
        seen.push(sql);
        if (sql === DAILY_DUE_WHERE) expect(params?.hz).toMatch(/^\d{4}-/);
        return qb;
      },
      getMany: () => Promise.resolve(rows.filter((r) => isDailyDue(r, hz))),
    };
    const repo = {
      createQueryBuilder: () => qb,
    } as unknown as Repository<Source>;
    const sched = new SourcesScheduler(repo, notifier, fakeEvents().events);
    const picked: string[] = [];
    const stub = sched as unknown as {
      monitorSources: (s: Source[]) => Promise<unknown[]>;
      reconcileExpected: () => Promise<unknown[]>;
    };
    stub.monitorSources = (s) => (
      picked.push(...s.map((x) => x.id)),
      Promise.resolve([])
    );
    stub.reconcileExpected = () => Promise.resolve([]);
    await sched.handleDailyMonitor();
    expect(seen).toContain(DAILY_DUE_WHERE);
    expect(picked).toEqual(['who_whs', 'drugfree_stats']);
  });

  it('the first read stores a baseline as checked (not changed); a failure only counts', async () => {
    const patches: Partial<Source>[] = [];
    const repo = {
      update: (_id: string, patch: Partial<Source>) => {
        patches.push(patch);
        return Promise.resolve({ affected: 1 });
      },
    } as unknown as Repository<Source>;
    const { events, recorded } = fakeEvents();
    const sched = new SourcesScheduler(repo, notifier, events);
    const s = sched as unknown as {
      sleep: (ms: number) => Promise<void>;
      fetchPage: (s: Source, m: string) => Promise<unknown>;
    };
    s.sleep = () => Promise.resolve();
    // HEAD 검증자 없음 → GET 본문 해시가 기준선
    s.fetchPage = (_s, m) =>
      Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: () => null },
        text: () => Promise.resolve(m === 'GET' ? '<p>WHS 2026</p>' : ''),
      });
    const who = src({
      id: 'who_whs',
      accessMethod: 'pdf',
      contentHash: null,
      lastCheckedAt: null,
    });
    const res = await sched.monitorSources([who]);
    expect(res).toEqual([
      { id: 'who_whs', status: 'unchanged', method: 'hash' },
    ]);
    expect(patches[0].lastCheckedAt).toBeInstanceOf(Date);
    expect(patches[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(patches[0].failCount).toBe(0);
    expect(recorded.map((r) => r.eventType)).toEqual(['checked']);

    // 첫 읽기 실패(재시도 포함 두 번) → failCount 1 · stale 아님 · lastCheckedAt 채움
    patches.length = 0;
    recorded.length = 0;
    s.fetchPage = () => Promise.reject(new Error('fetch failed'));
    const bad = await sched.monitorSources([{ ...who, id: 'euda_edr' }]);
    expect(bad[0]).toMatchObject({ status: 'error', failCount: 1 });
    expect(patches[0]).toMatchObject({ failCount: 1, status: 'active' });
    expect(patches[0].lastCheckedAt).toBeInstanceOf(Date);
    expect(recorded.map((r) => r.eventType)).toEqual(['failed']);
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
