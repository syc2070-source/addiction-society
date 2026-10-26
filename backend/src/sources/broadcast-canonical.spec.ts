import {
  archiveListDecision,
  archiveListIds,
  archiveListScope,
  feedOnlyDecision,
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

/**
 * SOC-R16 ■1 「목록 정본 v1 · 부재 추론 0」 — 숨김은 목록 짝(news_id ∨ videoId)의 tier 로만.
 * 10-26 13:1x 실측: ?tier=all = days null · truncated false · count 59(archive 38 · publish 21 · videoId 59/59) ·
 * 연대기 21 = 방송 목록 21 = publish 21.
 */
describe('목록 정본 v1 · 부재 추론 0 (SOC-R16 ■1)', () => {
  const stored = [
    row(1), // 방송 목록에 있음
    row(2), // publish(방송 목록 50 밖)
    row(3), // 목록에 없음(막힘 따위)
    row(4, SOURCE_ARCHIVED), // 오래 숨긴 편 — 전 기간 publish 로 돌아옴
    row(5, 'owner_hidden'), // 사람 숨김
    row(6, null, null), // news_id 도 영상 id 도 없는 행
    row(7), // archive 로 짝
    row(8), // deleted 로 짝
  ];
  const list = [
    entry(2, 'publish'),
    entry(4, 'publish'),
    entry(7, 'archive'),
    entry(8, 'deleted'),
  ];
  const feed = new Set([u(1)]);

  it('hides only by a list match (archive / deleted); a row missing from the list stays visible', () => {
    const d = archiveListDecision(stored, list, feed);
    expect(d.held).toBeNull();
    expect(d.hide).toEqual([7]);
    expect(d.hideDeleted).toEqual([8]);
    expect(d.unlisted.sort()).toEqual([3, 6]);
    expect(d.unhide).toEqual([4]);
    // 사람 숨김 · 방송 목록에 있는 행은 그대로
    expect([...d.hide, ...d.hideDeleted]).not.toContain(5);
    expect([...d.hide, ...d.hideDeleted]).not.toContain(1);
  });

  it('a list match by video id (no news_id yet) hides the same way', () => {
    const r: StoredBroadcast = {
      id: 9,
      url: 'https://youtu.be/Ab3dEfGhIjK',
      hiddenReason: null,
      newsId: null,
    };
    const d = archiveListDecision(
      [r],
      [{ ...entry(9, 'archive'), videoId: 'Ab3dEfGhIjK' }],
      new Set(),
    );
    expect(d.hide).toEqual([9]);
    expect(d.idFill).toEqual([{ id: 9, newsId: nid(9) }]);
  });

  it('empty list or truncated list: hide 0 (positive evidence may still bring rows back)', () => {
    const empty = archiveListDecision(stored, [], feed);
    expect(empty.held).toBe('empty_list');
    expect([...empty.hide, ...empty.hideDeleted]).toEqual([]);
    const cut = archiveListDecision(stored, list, feed, { truncated: true });
    expect(cut.held).toBe('truncated_list');
    expect([...cut.hide, ...cut.hideDeleted]).toEqual([]);
    expect(cut.unhide).toEqual([4]);
  });

  it('an old source_unlisted row (SOC-R15 absence) shows again unless the list carries it under any tier', () => {
    const rows = [
      row(3, SOURCE_UNLISTED), // 응답 어디에도 없음 → 다시 보임
      row(7, SOURCE_UNLISTED), // archive 로 짝 → 까닭만 바꿈
      row(10, SOURCE_UNLISTED), // 모르는 tier 줄로 실림 → 그대로
    ];
    const ids = new Set([nid(7), nid(10)]);
    const d = archiveListDecision(rows, [entry(7, 'archive')], new Set(), {
      listedIds: ids,
    });
    expect(d.unhide).toEqual([3]);
    expect(d.hide).toEqual([7]);
    // 잘린 날은 부재를 근거로 쓰지 않음
    const cut = archiveListDecision(rows, [entry(7, 'archive')], new Set(), {
      listedIds: ids,
      truncated: true,
    });
    expect(cut.unhide).toEqual([]);
  });

  it('end to end from the 10-26 shape: days null + truncated false → canonical, yet a row missing from the list is not hidden', () => {
    const body = {
      kind: 'broadcast',
      tier: 'all',
      days: null,
      available: true,
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
    const scope = archiveListScope(body);
    expect(scope).toEqual({
      publishAllTime: true,
      truncated: false,
      canonical: true,
    });
    const d = archiveListDecision(
      [row(2), row(3), row(4)],
      parseArchiveList(body)!,
      new Set(),
      { truncated: scope.truncated, listedIds: archiveListIds(body) },
    );
    expect([...d.hide, ...d.hideDeleted]).toEqual([]);
    expect(d.unlisted.sort()).toEqual([3, 4]);
    expect(archiveListIds(body)).toEqual(new Set([nid(2), nid(4)]));
    expect(SOURCE_DELETED).toBe('source_deleted');
  });
});

describe('보관 목록을 못 읽은 날 feedOnlyDecision (SOC-R16 ■1)', () => {
  it('missing from the feed is not a reason to hide; back in the feed shows again', () => {
    const d = feedOnlyDecision(
      [row(1), row(2), row(3, SOURCE_ARCHIVED), row(4, 'owner_hidden')],
      new Set([u(3), u(4)]),
    );
    expect(d).toEqual({ hide: [], unhide: [3], held: 'no_list' });
  });
});
