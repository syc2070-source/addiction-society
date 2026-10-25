import {
  archiveListDecision,
  archiveListIds,
  archiveListScope,
  parseArchiveList,
  SOURCE_ARCHIVED,
  SOURCE_DELETED,
  SOURCE_UNLISTED,
  type ArchiveListEntry,
  type StoredBroadcast,
} from './broadcast.util';

/**
 * SOC-R15 ■3 (CTO C3) — 중독뉴스가 방송 publish 목록을 전 기간으로 열면(NEWS-Q16 ■4) 「목록이 정본」.
 * 10-25 실측: ?tier=all = days 120 · count 59(archive 38 · publish 21) · truncated false → 아직 대기.
 */
const u = (id: number) => `https://www.youtube.com/watch?v=row${id}`;
const nid = (id: number) => 6000 + id;
const row = (
  id: number,
  hiddenReason: string | null = null,
  newsId: number | null = nid(id),
): StoredBroadcast => ({ id, url: u(id), hiddenReason, newsId });
const entry = (
  id: number,
  tier: ArchiveListEntry['tier'],
): ArchiveListEntry => ({
  id: nid(id),
  tier,
  changedAt: new Date('2026-10-25T03:00:00Z'),
  videoId: null,
});

describe('보관 목록 정본 판정 archiveListScope (SOC-R15 ■3)', () => {
  it('10-25 real response (days 120 · truncated false) is NOT canonical — wait', () => {
    const real = {
      kind: 'broadcast',
      tier: 'all',
      days: 120,
      generatedAt: '2026-10-25T10:33:27.545Z',
      available: true,
      count: 59,
      truncated: false,
      items: [],
    };
    expect(archiveListScope(real)).toEqual({
      publishAllTime: false,
      truncated: false,
      canonical: false,
    });
  });

  it('canonical only when the response itself says publish is all-time and nothing was cut', () => {
    const base = { available: true, truncated: false, items: [] };
    expect(archiveListScope({ ...base, publishAllTime: true }).canonical).toBe(
      true,
    );
    expect(
      archiveListScope({ ...base, publish_all_time: true }).canonical,
    ).toBe(true);
    expect(archiveListScope({ ...base, publishDays: null }).canonical).toBe(
      true,
    );
    expect(archiveListScope({ ...base, days: null }).canonical).toBe(true);
    // 잘림 · truncated 없음 · available false · 배열만 · 꼴 모름 → 정본 아님
    expect(
      archiveListScope({ ...base, publishAllTime: true, truncated: true })
        .canonical,
    ).toBe(false);
    expect(
      archiveListScope({ available: true, publishAllTime: true, items: [] })
        .canonical,
    ).toBe(false);
    expect(
      archiveListScope({ ...base, available: false, publishAllTime: true })
        .canonical,
    ).toBe(false);
    expect(archiveListScope([]).canonical).toBe(false);
    expect(archiveListScope(null).canonical).toBe(false);
    // days 가 없는 것(undefined)은 「전 기간」이 아니다 · 'true' 글도 아님
    expect(archiveListScope({ ...base }).canonical).toBe(false);
    expect(
      archiveListScope({ ...base, publishAllTime: 'true' }).canonical,
    ).toBe(false);
  });
});

describe('「목록이 정본」 규칙 (SOC-R15 ■3)', () => {
  const stored = [
    row(1), // 방송 목록에 있음
    row(2), // publish(방송 목록 50 밖)
    row(3), // 목록에 없음(막힘 따위)
    row(4, SOURCE_ARCHIVED), // 120일 넘게 숨긴 편 — 전 기간 publish 로 돌아옴
    row(5, 'owner_hidden'), // 사람 숨김
    row(6, null, null), // news_id 도 영상 id 도 없는 행
  ];
  const list = [entry(2, 'publish'), entry(4, 'publish')];
  const feed = new Set([u(1)]);

  it('wait (not canonical): rows missing from both lists stay as they are (counted only)', () => {
    const d = archiveListDecision(stored, list, feed);
    expect(d.hideUnlisted).toEqual([]);
    expect(d.unlisted.sort()).toEqual([3, 6]);
    expect(d.unhide).toEqual([4]);
  });

  it('canonical: a visible row missing from both lists comes down as source_unlisted; publish brings old hidden ones back', () => {
    const d = archiveListDecision(stored, list, feed, { canonical: true });
    expect(d.hideUnlisted).toEqual([3]);
    // 리뷰 B5: news_id 를 모르는(영상 id 로도 못 맞춘) 행은 「없음」이 아니라 「못 맞춤」 → 그대로
    expect(d.unlisted).toEqual([6]);
    expect(d.unhide).toEqual([4]);
    expect(d.hide).toEqual([]);
    // 사람 숨김 · 방송 목록에 있는 행은 그대로
    expect(d.hideUnlisted).not.toContain(5);
    expect(d.hideUnlisted).not.toContain(1);
  });

  it('canonical: an unlisted row that comes back (feed or publish) shows again; archive/deleted re-label it', () => {
    const rows = [
      row(3, SOURCE_UNLISTED),
      row(7, SOURCE_UNLISTED),
      row(8, SOURCE_UNLISTED),
      row(9, SOURCE_UNLISTED),
    ];
    const d = archiveListDecision(
      rows,
      [entry(7, 'publish'), entry(8, 'archive'), entry(9, 'deleted')],
      new Set([u(3)]),
      { canonical: true },
    );
    expect(d.unhide.sort()).toEqual([3, 7]);
    expect(d.hide).toEqual([8]);
    expect(d.hideDeleted).toEqual([9]);
    // 이미 source_unlisted 인 행은 다시 내리지 않음
    expect(d.hideUnlisted).toEqual([]);
  });

  it('canonical but empty list: hold (never hides everything on a broken day)', () => {
    const d = archiveListDecision(stored, [], feed, { canonical: true });
    expect(d.held).toBe('empty_list');
    expect(d.hideUnlisted).toEqual([]);
  });

  it('end to end from a response: days null + truncated false → canonical → unlisted row hidden; an unknown-tier line still counts as listed', () => {
    const body = {
      available: true,
      days: null,
      truncated: false,
      items: [
        { id: nid(2), tier: 'publish', changedAt: null, videoId: null },
        {
          id: nid(4),
          tier: 'blocked_new_word',
          changedAt: null,
          videoId: null,
        },
      ],
    };
    const d = archiveListDecision(
      [row(2), row(3), row(4)],
      parseArchiveList(body)!,
      new Set(),
      {
        canonical: archiveListScope(body).canonical,
        listedIds: archiveListIds(body),
      },
    );
    expect(d.hideUnlisted).toEqual([3]);
    // 모르는 tier 로 읽지 않은 줄의 편은 목록에 있다 → 내리지 않음(리뷰 B5)
    expect(d.unlisted).toEqual([4]);
    expect(archiveListIds(body)).toEqual(new Set([nid(2), nid(4)]));
    expect(SOURCE_DELETED).toBe('source_deleted');
  });
});
