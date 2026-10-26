import { Source } from './entities/source.entity';
import { missedReleases, type EventLike } from './missed-releases';
import { backfillPlan, computeNextExpected } from './next-expected.util';

/**
 * SOC-R16 ■5 — 11-01(일)에 「지난 예정 · 미확인」 세 줄이 서는가(코드·설정 실측).
 * 운영 설정(10-26 13:2x · GET /api/sources): 세 소스 모두 next_expected_at 2026-10-01 ·
 *  spo_drug_monthly(monthly · pdf · 마지막 발간 2026-09-30) · drugfree_stats(monthly · html) ·
 *  mohw_addiction_center(annual 10월 · manual).
 * 길: 04:00 KST(= 10-31 19:00 UTC)의 backfill:next 는 달 경계를 UTC 로 재므로 아직 10월 → 이월 0.
 *     09:00 KST(= 11-01 00:00 UTC) 감시 크론이 먼저 읽고(checked) 그다음 이월(rescheduled overdue) →
 *     spo · drugfree = 「발표 없음」(not_published) · mohw = 「사람 확인」(manual).
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
  it('the 04:00 KST run on 11-01 does not roll yet (UTC month); the 09:00 KST cron does', () => {
    const at0400 = new Date('2026-10-31T19:00:00Z');
    const at0900 = new Date('2026-11-01T00:00:00Z');
    for (const s of SOURCES) {
      expect(backfillPlan(s, at0400)).toBeNull();
      expect(backfillPlan(s, at0900)).toMatchObject({ rolled: true });
    }
    expect(computeNextExpected(SOURCES[0], at0900)).toBe('2026-11-01');
    expect(computeNextExpected(SOURCES[2], at0900)).toBe('2027-10-01');
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
