import { Source } from './entities/source.entity';
import { computeNextExpected } from './next-expected.util';
import {
  missedReleases,
  monitorCounts,
  monitorState,
  overdueAction,
} from './missed-releases';

// SOC-R3 ■4 — 발표 예정 이월 · 「지난 예정 · 미확인」.
const src = (p: Partial<Source>): Source =>
  ({
    id: 'x',
    org: 'org',
    orgKo: '기관',
    titleKo: '자료',
    titleEn: 'Data',
    url: 'https://example.go.kr/',
    cadence: 'annual',
    expectedMonth: [10],
    lastPublishedAt: null,
    nextExpectedAt: null,
    ...p,
  }) as Source;

// 운영 10-13 실측 두 건(next_expected_at 2026-10-01 · 발표 이력 없음).
const drugfree = src({
  id: 'drugfree_stats',
  cadence: 'monthly',
  expectedMonth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  nextExpectedAt: '2026-10-01',
});
const mohw = src({
  id: 'mohw_addiction_center',
  cadence: 'annual',
  expectedMonth: [10],
  nextExpectedAt: '2026-10-01',
});
const adhoc = src({
  id: 'adhoc',
  cadence: 'irregular',
  expectedMonth: null,
  nextExpectedAt: '2026-09-01',
});

describe('발표 예정 이월 (월 단위)', () => {
  it('10-13: October releases are not past yet — they stay this month, no missed line', () => {
    const today = new Date('2026-10-13T03:00:00Z');
    expect(computeNextExpected(drugfree, today)).toBe('2026-10-01');
    expect(computeNextExpected(mohw, today)).toBe('2026-10-01');
    expect(missedReleases([drugfree, mohw], [], today)).toEqual([]);
  });

  it('11-02 before the roll: cadence → forward by its period, no cadence → 확인 필요', () => {
    const today = new Date('2026-11-02T00:00:00Z');
    expect(overdueAction(drugfree)).toBe('roll');
    expect(overdueAction(adhoc)).toBe('check');
    const out = missedReleases([drugfree, mohw, adhoc], [], today);
    expect(out.map((m) => [m.sourceId, m.expected, m.next, m.action])).toEqual([
      ['drugfree_stats', '2026-10', '2026-11', 'rolled'],
      ['mohw_addiction_center', '2026-10', '2027-10', 'rolled'],
      ['adhoc', '2026-09', null, 'check'],
    ]);
  });

  it('after the roll the rescheduled event keeps the line until a release is seen', () => {
    const today = new Date('2026-11-05T00:00:00Z');
    const rolled = { ...mohw, nextExpectedAt: '2027-10-01' } as Source;
    const ev = {
      sourceId: 'mohw_addiction_center',
      eventType: 'rescheduled',
      detectedAt: '2026-11-01T19:00:00Z',
      detail: { from: '2026-10-01', to: '2027-10-01', reason: 'overdue' },
    };
    expect(missedReleases([rolled], [ev], today)).toEqual([
      expect.objectContaining({
        sourceId: 'mohw_addiction_center',
        expected: '2026-10',
        next: '2027-10',
        action: 'rolled',
      }),
    ]);
    // 발간 확인(published) 뒤에는 빠진다
    const seen = {
      sourceId: 'mohw_addiction_center',
      eventType: 'published',
      detectedAt: '2026-11-04T00:00:00Z',
      detail: null,
    };
    expect(missedReleases([rolled], [ev, seen], today)).toEqual([]);
    // 창(120일) 밖은 빠진다
    expect(
      missedReleases([rolled], [ev], new Date('2027-04-01T00:00:00Z')),
    ).toEqual([]);
  });
});

// SOC-R4 ■2 — 「발표 없음」(읽었는데 없음)과 「읽지 못함」(감시 실패)을 가른다.
describe('지난 예정의 감시 꼬리표', () => {
  // 운영 10-14 실측: drugfree_stats stale · fail_count 3 · 마지막 확인 07-21 · 08·09월 이월 사건.
  const staleDrugfree = {
    ...drugfree,
    accessMethod: 'html',
    status: 'stale',
    failCount: 3,
  } as Source;
  const rolledEv = (from: string, to: string, at: string) => ({
    sourceId: 'drugfree_stats',
    eventType: 'rescheduled',
    detectedAt: at,
    detail: { from, to, reason: 'overdue', publicationConfirmed: false },
  });
  const today = new Date('2026-10-14T03:00:00Z');
  const rolls = [
    rolledEv('2026-08-01', '2026-09-01', '2026-09-01T00:00:00Z'),
    rolledEv('2026-09-01', '2026-10-01', '2026-10-01T00:00:00Z'),
  ];

  it('a stale source reads as 「읽지 못함」, never as 「발표 없음」', () => {
    const out = missedReleases([staleDrugfree], rolls, today);
    expect(out.map((m) => [m.expected, m.monitor])).toEqual([
      ['2026-09', 'unreadable'],
      ['2026-08', 'unreadable'],
    ]);
  });

  it('after a successful read past the month: 발표 없음 · a read inside the month is still 확인 전', () => {
    const recovered = { ...staleDrugfree, status: 'active', failCount: 0 };
    // 10-15 09:00 KST 읽기 성공(stale → active) — 08·09월 모두 그 달이 끝난 뒤 읽음
    const read = {
      sourceId: 'drugfree_stats',
      eventType: 'checked',
      detectedAt: '2026-10-15T00:00:05Z',
      detail: { method: 'board-latest', recoveredFrom: 'stale' },
    };
    const later = new Date('2026-10-15T03:00:00Z');
    expect(
      missedReleases([recovered], [...rolls, read], later).map(
        (m) => m.monitor,
      ),
    ).toEqual(['not_published', 'not_published']);
    // 09-30 23:00 KST 의 읽기는 9월 안 — 9월 예정은 「확인 전」, 8월은 「발표 없음」
    const inSept = { ...read, detectedAt: '2026-09-30T14:00:00Z' };
    expect(
      missedReleases([recovered], [...rolls, inSept], later).map((m) => [
        m.expected,
        m.monitor,
      ]),
    ).toEqual([
      ['2026-09', 'unchecked'],
      ['2026-08', 'not_published'],
    ]);
    // 마지막 감시가 차단·실패면 다시 「읽지 못함」 · 수동 소스는 「사람 확인」
    const blocked = {
      ...read,
      eventType: 'blocked',
      detectedAt: '2026-10-16T00:00:00Z',
    };
    expect(
      missedReleases([recovered], [...rolls, read, blocked], later).map(
        (m) => m.monitor,
      ),
    ).toEqual(['unreadable', 'unreadable']);
    expect(
      monitorState(
        { status: 'active', accessMethod: 'manual' },
        '2026-09',
        undefined,
      ),
    ).toBe('manual');
  });

  it('monitor counts for /api/health/nightly: stale and unreachable', () => {
    expect(
      monitorCounts([
        { status: 'stale', failCount: 3 },
        { status: 'active', failCount: 1 },
        { status: 'active', failCount: 0 },
      ]),
    ).toEqual({ sources: 3, stale: 1, unreachable: 2 });
  });
});
