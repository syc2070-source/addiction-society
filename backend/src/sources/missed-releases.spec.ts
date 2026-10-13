import { Source } from './entities/source.entity';
import { computeNextExpected } from './next-expected.util';
import { missedReleases, overdueAction } from './missed-releases';

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
