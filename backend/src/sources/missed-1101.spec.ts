import { readFileSync } from 'fs';
import { join } from 'path';
import { Source } from './entities/source.entity';
import { missedReleases, rollSummary, type EventLike } from './missed-releases';
import {
  backfillPlan,
  computeNextExpected,
  isExpectedOverdue,
  kstDateParts,
  monthStartOf,
} from './next-expected.util';

/**
 * SOC-R16 ■5 — 11-01(일)에 「지난 예정 · 미확인」 세 줄이 서는가(코드·설정 실측).
 * 운영 설정(10-26 13:2x · GET /api/sources): 세 소스 모두 next_expected_at 2026-10-01 ·
 *  spo_drug_monthly(monthly · pdf · 마지막 발간 2026-09-30) · drugfree_stats(monthly · html) ·
 *  mohw_addiction_center(annual 10월 · manual).
 * 길(SOC-R17 ■3 · 달 경계 KST 한 자리 kstDateParts): 11-01 00:00 KST 부터 11월 — 세 줄이 「확인 전」(unchecked ·
 *     mohw = manual)으로 서고, 04:00 backfill:next 는 이월하지 않으며(빈 값 채움만 · 리뷰 B1), 09:00 KST 감시 크론이
 *     먼저 읽고(checked) 그다음 이월(rescheduled overdue) → spo · drugfree = not_published · mohw = manual(09:00 세 줄 그대로).
 *     (SOC-R16 판은 UTC 경계라 04:00 에 이월 0 · 09:00 이월이었다.)
 */
const src = (over: Partial<Source>): Source =>
  ({
    titleKo: 't',
    titleEn: 't',
    orgKo: 'o',
    org: 'o',
    url: 'https://x',
    status: 'active',
    failCount: 0,
    expectedMonth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    nextExpectedAt: '2026-10-01',
    ...over,
  }) as Source;

const SOURCES = [
  src({
    id: 'spo_drug_monthly',
    cadence: 'monthly',
    accessMethod: 'pdf',
    lastPublishedAt: '2026-09-30',
  }),
  src({
    id: 'drugfree_stats',
    cadence: 'monthly',
    accessMethod: 'html',
    lastPublishedAt: '2026-03-09',
  }),
  src({
    id: 'mohw_addiction_center',
    cadence: 'annual',
    expectedMonth: [10],
    accessMethod: 'manual',
    lastPublishedAt: null,
  }),
];

describe('11-01 세 줄 (SOC-R16 ■5)', () => {
  it('KST boundary: 10-31 23:59 KST is still October (no roll)', () => {
    const at2359 = new Date('2026-10-31T14:59:00Z'); // 10-31 23:59 KST
    expect(monthStartOf(at2359)).toBe('2026-10-01');
    for (const s of SOURCES) {
      expect(isExpectedOverdue(s.nextExpectedAt, at2359)).toBe(false);
      expect(backfillPlan(s, at2359)).toBeNull();
    }
  });

  it('KST boundary: 11-01 00:00 ~ 09:00 KST is November — the plan says roll (backfill:next defers it to the 09:00 read)', () => {
    for (const at of [
      '2026-10-31T15:00:00Z', // 11-01 00:00 KST
      '2026-10-31T19:00:00Z', // 04:00 KST (backfill:next)
      '2026-10-31T23:59:00Z', // 08:59 KST
      '2026-11-01T00:00:00Z', // 09:00 KST (감시 크론)
    ]) {
      const t = new Date(at);
      expect(monthStartOf(t)).toBe('2026-11-01');
      expect(kstDateParts(t)).toEqual({ y: 2026, m: 10, d: 1 });
      for (const s of SOURCES) {
        expect(backfillPlan(s, t)).toMatchObject({ rolled: true });
      }
      expect(computeNextExpected(SOURCES[0], t)).toBe('2026-11-01');
      expect(computeNextExpected(SOURCES[2], t)).toBe('2027-10-01');
    }
    // 홈 「이번 달」 하한(monthStartOf)이 00:00 KST 에 넘어감 — 폴백 길(발표 이력 없음)도 11월부터
    expect(
      computeNextExpected(
        src({ id: 'x', cadence: 'monthly', lastPublishedAt: null }),
        new Date('2026-10-31T15:00:00Z'),
      ),
    ).toBe('2026-11-01');
  });

  it('00:00 ~ 09:00 KST: not rolled yet (backfill:next only fills empty values), the lines stand as unchecked until the 09:00 read', () => {
    // 리뷰 B1: 04:00 에 이월하면 연간 출처가 09:00 감시 30일 창 밖으로 밀려 달 끝 읽기를 못 받는다
    const backfill = readFileSync(
      join(__dirname, 'seed', 'backfill-next.ts'),
      'utf8',
    );
    expect(backfill).toMatch(/if \(plan\.rolled\) \{\s*deferred\.push/);
    expect(backfill).not.toContain("eventType: 'rescheduled'");
    // 이월 전(next_expected_at 10-01 그대로) · 10-31 09:00 KST 의 마지막 읽기(달 끝 전)
    const lastRead: EventLike[] = SOURCES.map((s) => ({
      sourceId: s.id,
      eventType: 'checked',
      detectedAt: '2026-10-31T00:00:10Z',
      detail: { method: 'hash' },
    }));
    const at0400 = missedReleases(
      SOURCES,
      lastRead,
      new Date('2026-10-31T19:00:30Z'),
    );
    expect(
      at0400.map((l) => [l.sourceId, l.expected, l.monitor]).sort(),
    ).toEqual([
      ['drugfree_stats', '2026-10', 'unchecked'],
      ['mohw_addiction_center', '2026-10', 'manual'],
      ['spo_drug_monthly', '2026-10', 'unchecked'],
    ]);
  });

  it('after the 09:00 read + roll: spo · drugfree = not published · mohw = person check', () => {
    const read = '2026-11-01T00:00:10Z'; // 09:00 KST 감시(먼저)
    const roll = '2026-11-01T00:01:00Z'; // 그 뒤 이월
    const events: EventLike[] = SOURCES.flatMap((s) => [
      {
        sourceId: s.id,
        eventType: 'checked',
        detectedAt: read,
        detail: { method: 'hash' },
      },
      {
        sourceId: s.id,
        eventType: 'rescheduled',
        detectedAt: roll,
        detail: {
          from: '2026-10-01',
          to: computeNextExpected(s, new Date(roll)),
          reason: 'overdue',
          publicationConfirmed: false,
        },
      },
    ]);
    const rolled = SOURCES.map((s) =>
      src({ ...s, nextExpectedAt: computeNextExpected(s, new Date(roll)) }),
    );
    const lines = missedReleases(
      rolled,
      events,
      new Date('2026-11-01T01:00:00Z'),
    );
    expect(
      lines.map((l) => [l.sourceId, l.expected, l.monitor]).sort(),
    ).toEqual([
      ['drugfree_stats', '2026-10', 'not_published'],
      ['mohw_addiction_center', '2026-10', 'manual'],
      ['spo_drug_monthly', '2026-10', 'not_published'],
    ]);
    // 9월 발간을 잡은 뒤 10월 발간을 잡으면 그 줄은 서지 않는다(발간 확인 = 줄 빠짐)
    const published = missedReleases(
      rolled,
      [
        ...events,
        {
          sourceId: 'spo_drug_monthly',
          eventType: 'published',
          detectedAt: '2026-11-01T00:02:00Z',
          detail: {},
        },
      ],
      new Date('2026-11-01T01:00:00Z'),
    );
    expect(published.map((l) => l.sourceId)).not.toContain('spo_drug_monthly');
  });
});

describe('health 이월 줄 (SOC-R18 ■3 · /api/health/nightly roll)', () => {
  const zero = { unreadable: 0, manual: 0, unchecked: 0, not_published: 0 };

  it('no roll yet: lastRolledAt null and every count 0 (an empty value is 0, never 「not published」)', () => {
    expect(rollSummary([], [])).toEqual({
      lastRolledAt: null,
      lines: 0,
      rolled: 0,
      check: 0,
      monitor: zero,
    });
    // 되돌리기(restore) 사건은 이월이 아님
    expect(
      rollSummary(
        [],
        [
          {
            sourceId: 'drugfree_stats',
            eventType: 'rescheduled',
            detectedAt: '2026-10-18T06:00:00Z',
            detail: { reason: 'restore' },
          },
        ],
      ).lastRolledAt,
    ).toBeNull();
  });

  it('11-01 08:59 KST (before the read): 3 lines unchecked · manual, no roll; after 09:00: 2 not published · 1 manual with the roll time', () => {
    const before = missedReleases(
      SOURCES,
      [],
      new Date('2026-10-31T23:59:00Z'),
    );
    expect(rollSummary(before, [])).toEqual({
      lastRolledAt: null,
      lines: 3,
      rolled: 3,
      check: 0,
      monitor: { ...zero, unchecked: 2, manual: 1 },
    });
    const roll = '2026-11-01T00:01:00Z';
    const events: EventLike[] = SOURCES.flatMap((s) => [
      {
        sourceId: s.id,
        eventType: 'checked',
        detectedAt: '2026-11-01T00:00:10Z',
        detail: { method: 'hash' },
      },
      {
        sourceId: s.id,
        eventType: 'rescheduled',
        detectedAt: roll,
        detail: {
          from: '2026-10-01',
          to: computeNextExpected(s, new Date(roll)),
          reason: 'overdue',
          publicationConfirmed: false,
        },
      },
    ]);
    const rolled = SOURCES.map((s) =>
      src({ ...s, nextExpectedAt: computeNextExpected(s, new Date(roll)) }),
    );
    const after = missedReleases(
      rolled,
      events,
      new Date('2026-11-01T01:00:00Z'),
    );
    expect(rollSummary(after, events)).toEqual({
      lastRolledAt: '2026-11-01T00:01:00.000Z',
      lines: 3,
      rolled: 3,
      check: 0,
      monitor: { ...zero, not_published: 2, manual: 1 },
    });
  });

  it('a roll with an empty next value is 「check」 (no next month made up), still counted', () => {
    const irr = src({
      id: 'x_irregular',
      cadence: 'irregular',
      accessMethod: 'html',
      lastPublishedAt: '2026-01-01',
    });
    const lines = missedReleases([irr], [], new Date('2026-11-01T01:00:00Z'));
    expect(lines).toEqual([
      expect.objectContaining({
        next: null,
        action: 'check',
        monitor: 'unchecked',
      }),
    ]);
    expect(rollSummary(lines, [])).toMatchObject({ rolled: 0, check: 1 });
  });

  it('the health route exposes it read-only next to monitor', () => {
    const health = readFileSync(
      join(__dirname, '..', 'health.controller.ts'),
      'utf8',
    );
    expect(health).toContain('roll: await this.roll()');
    expect(health).toContain('rollSummary(rows, rescheduled)');
    expect(health).not.toMatch(/\.(update|save|insert|delete)\(/);
  });
});
