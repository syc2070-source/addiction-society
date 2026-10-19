import type { Repository } from 'typeorm';
import { SourcesScheduler, normalizeForHash } from './sources.scheduler';
import type {
  RecordEventInput,
  SourceEventsService,
} from './source-events.service';
import type { SourcesNotifier } from './discord.notifier';
import type { Source } from './entities/source.entity';
import {
  digitMask,
  fingerprint,
  isNotRelease,
  judgeHashChange,
  readFingerprint,
} from './hash-noise';
import { confirmsRelease } from './missed-releases';

/** SOC-R9 ■2 — 본문 해시 감시: 날짜·숫자 글자만 바뀐 날은 「발간 아님」(changed 0). */

const PAD = 'Harm reduction services worldwide. '.repeat(120);

/** 토막 셋의 바탕 본문 — 실제 hri 쪽처럼 길이가 수천 자 */
const page = (updated: string, views: string, extra = '') =>
  `<html><body><h1>Global State of Harm Reduction</h1>${extra}<p>Last updated ${updated}</p><p>Views ${views}</p><p>${PAD}</p><a href="/gshr-2024.pdf">2024 report</a></body></html>`;

function scheduler(bodies: string[]) {
  const patches: Partial<Source>[] = [];
  const repo = {
    update: (_id: string, p: Partial<Source>) => (
      patches.push(p),
      Promise.resolve({ affected: 1 })
    ),
  } as unknown as Repository<Source>;
  const recorded: RecordEventInput[] = [];
  const notified: string[] = [];
  const events = {
    record: (e: RecordEventInput) => (recorded.push(e), Promise.resolve()),
    lastFingerprint: () => {
      const last = [...recorded]
        .reverse()
        .find((r) => readFingerprint(r.detail));
      return Promise.resolve(last ? readFingerprint(last.detail) : null);
    },
  } as unknown as SourceEventsService;
  const notifier = {
    notify: (_s: Source, kind: string) => (
      notified.push(kind),
      Promise.resolve()
    ),
  } as unknown as SourcesNotifier;
  const sched = new SourcesScheduler(repo, notifier, events);
  const s = sched as unknown as {
    sleep: (ms: number) => Promise<void>;
    fetchPage: (s: Source, m: string) => Promise<unknown>;
  };
  let n = 0;
  s.sleep = () => Promise.resolve();
  s.fetchPage = (_src, m) => {
    // 본문은 GET 마다 다음 날 것(HEAD 는 검증자 없음 → GET 으로 넘어감)
    const body = bodies[Math.min(m === 'GET' ? n++ : n, bodies.length - 1)];
    return Promise.resolve({
      status: 200,
      ok: true,
      headers: { get: () => null },
      text: () => Promise.resolve(body),
    });
  };
  let hash: string | null = null;
  /** 하루 한 번 감시 — 앞날의 contentHash 를 이어받는다 */
  const day = async (p: Partial<Source> = {}) => {
    const before = patches.length;
    const [res] = await sched.monitorSources([
      hri({ contentHash: hash, ...p }),
    ]);
    const got = patches.slice(before).find((x) => x.contentHash)?.contentHash;
    if (got) hash = got;
    return res;
  };
  return { day, recorded, notified, patches };
}

const hri = (p: Partial<Source> = {}) =>
  ({
    id: 'hri_gshr',
    url: 'https://hri.global/flagship-research/the-global-state-of-harm-reduction/',
    accessMethod: 'pdf',
    accessDetail: { detect: 'hash' },
    cadence: 'annual',
    expectedMonth: [11],
    status: 'active',
    failCount: 0,
    etag: null,
    lastModified: null,
    contentHash: null,
    lastCheckedAt: new Date('2026-10-19T00:00:00Z'),
    lastPublishedAt: '2025-12-03',
    nextExpectedAt: '2026-11-01',
    lastNotifiedAt: null,
    ...p,
  }) as unknown as Source;

describe('SOC-R9 ■2 hash noise — three fragments', () => {
  it('fragment 1: only the date changed → checked{notRelease}, no changed event, hash moves on, no alert', async () => {
    const { day, recorded, notified } = scheduler([
      page('16 October 2026', '1,234'),
      page('19 October 2026', '1,234'),
    ]);
    expect(await day()).toMatchObject({ status: 'unchanged', method: 'hash' }); // 기준선
    expect(readFingerprint(recorded[0].detail)).not.toBeNull();
    const res = await day();
    expect(res).toMatchObject({ status: 'unchanged', method: 'hash' });
    expect(recorded.map((r) => r.eventType)).toEqual(['checked', 'checked']);
    const nr = recorded[1].detail?.notRelease as Record<string, unknown>;
    expect(nr).toMatchObject({ reason: 'digits-only' });
    expect(nr.lenDiffRatio as number).toBeLessThan(0.01);
    expect(nr.prevHash).not.toBe(nr.newHash);
    expect(notified).toEqual([]);
    // 다음 날 같은 본문 → 그냥 확인(표식 없음)
    await day();
    expect(recorded[2].eventType).toBe('checked');
    expect(recorded[2].detail?.notRelease).toBeUndefined();
  });

  it('fragment 2: only a view counter changed → not a release either', async () => {
    const { day, recorded } = scheduler([
      page('16 October 2026', '1,234'),
      page('16 October 2026', '12,340'),
    ]);
    await day();
    await day();
    expect(recorded.map((r) => r.eventType)).toEqual(['checked', 'checked']);
    expect(recorded[1].detail?.notRelease).toBeTruthy();
  });

  it('fragment 3: new words (a 2026 edition) → changed as before, with the next baseline', async () => {
    const { day, recorded, notified } = scheduler([
      page('16 October 2026', '1,234'),
      page(
        '3 November 2026',
        '1,234',
        '<h2>The Global State of Harm Reduction 2026 is out now</h2>',
      ),
    ]);
    await day();
    const res = await day();
    expect(res).toMatchObject({ status: 'changed', method: 'hash' });
    expect(recorded.map((r) => r.eventType)).toEqual(['checked', 'changed']);
    expect(recorded[1].detail?.notRelease).toBeUndefined();
    expect(readFingerprint(recorded[1].detail)).not.toBeNull();
    expect(confirmsRelease(recorded[1] as never)).toBe(true);
    expect(notified).toEqual(['change']);
  });

  it('no earlier fingerprint, or a ≥1% length change, or a non-hash source → the rule does not apply', async () => {
    // 앞 fp 없음(10-19 기준선은 fp 이전): 지금처럼 changed
    const noFp = scheduler([page('19 October 2026', '1,234')]);
    const r = await noFp.day({ contentHash: 'e1e8f848441da12f' });
    expect(r.status).toBe('changed');

    const prev = fingerprint(normalizeForHash(page('16 October 2026', '1')));
    // 숫자만 바뀌었어도 길이가 1% 넘게 달라지면 발간 아님이 아니다
    const long = fingerprint(
      normalizeForHash(page('16 October 2026', '1'.repeat(200))),
    );
    expect(long.masked).toBe(prev.masked);
    expect(
      judgeHashChange(prev, long, { prevHash: 'a', newHash: 'b' }),
    ).toBeNull();
    expect(
      judgeHashChange(null, prev, { prevHash: 'a', newHash: 'b' }),
    ).toBeNull();

    // detect 'hash' 가 아닌 출처(게시판·data.go.kr 등)는 fp 도 규칙도 없다
    const other = scheduler([
      page('16 October 2026', '1'),
      page('19 October 2026', '1'),
    ]);
    await other.day({ id: 'kcgp_rehab', accessDetail: null });
    const res = await other.day({ id: 'kcgp_rehab', accessDetail: null });
    expect(res.status).toBe('changed');
    expect(other.recorded.every((e) => !readFingerprint(e.detail))).toBe(true);
  });

  it('digitMask hides day numbers, counters and month names — not years, not tags', () => {
    expect(digitMask('Last updated 16 October 2026 · Views 1,234.5')).toBe(
      'Last updated 0 0 2026 · Views 0',
    );
    expect(
      digitMask('<a href="/uploads/2024/11/GSHR-2024.pdf">7 pages</a>'),
    ).toBe('<a href="/uploads/2024/11/GSHR-2024.pdf">0 pages</a>');
  });

  it('a new edition that only swaps the year (text and PDF link) is changed, not noise', async () => {
    const edition = (y: string) =>
      page('16 October 2026', '1,234').replace(
        '<a href="/gshr-2024.pdf">2024 report</a>',
        `<a href="/gshr-${y}.pdf">${y} report</a>`,
      );
    const { day, recorded } = scheduler([edition('2024'), edition('2026')]);
    await day();
    expect(await day()).toMatchObject({ status: 'changed', method: 'hash' });
    expect(recorded[1].detail?.notRelease).toBeUndefined();
  });
});

describe('SOC-R9 ■2 marking old events (no row change)', () => {
  const hriDetail = { detect: 'hash' };
  // 10월 hri changed 6건(10-03 · 06 · 11 · 15 · 16 · 17) 꼴
  const october = [
    {
      eventType: 'changed',
      detail: { method: 'last-modified' },
      detectedAt: '2026-10-03T00:00:01.367Z',
    },
    {
      eventType: 'changed',
      detail: { method: 'last-modified', cooldown: true },
      detectedAt: '2026-10-17T00:00:10.203Z',
    },
  ];

  it('only the reclassified window (October, before the hash switch) is marked', () => {
    for (const at of ['2025-12-03T00:00:00Z', '2026-10-18T09:00:00Z']) {
      expect(
        isNotRelease({ ...october[0], detectedAt: at }, { detect: 'hash' }),
      ).toBe(false);
    }
    expect(
      isNotRelease({ ...october[0], detectedAt: null }, { detect: 'hash' }),
    ).toBe(false);
  });

  it('the six October hri Last-Modified changes read as not-a-release; other sources and kinds do not', () => {
    for (const e of october) expect(isNotRelease(e, hriDetail)).toBe(true);
    // 같은 꼴이라도 본문 해시 감시가 아닌 출처(WHO 등)는 표식 없음
    expect(isNotRelease(october[0], null)).toBe(false);
    expect(isNotRelease(october[0], { board: {} })).toBe(false);
    // hri 의 hash changed · checked · source_updated 는 표식 없음
    expect(
      isNotRelease(
        { eventType: 'changed', detail: { method: 'hash' } },
        hriDetail,
      ),
    ).toBe(false);
    expect(
      isNotRelease(
        { eventType: 'checked', detail: { method: 'hash' } },
        hriDetail,
      ),
    ).toBe(false);
    expect(
      isNotRelease({ eventType: 'source_updated', detail: {} }, hriDetail),
    ).toBe(false);
    // 새 규칙의 확인 줄은 출처와 무관하게 표식
    expect(
      isNotRelease(
        {
          eventType: 'checked',
          detail: { notRelease: { reason: 'digits-only' } },
        },
        null,
      ),
    ).toBe(true);
  });

  it('a not-release mark never confirms a release', () => {
    expect(
      confirmsRelease({
        eventType: 'changed',
        detail: { method: 'hash', notRelease: { reason: 'digits-only' } },
      } as never),
    ).toBe(false);
    expect(
      confirmsRelease({
        eventType: 'changed',
        detail: { method: 'hash' },
      } as never),
    ).toBe(true);
  });
});
