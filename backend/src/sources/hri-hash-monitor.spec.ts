import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner, Repository } from 'typeorm';
import { HriHashMonitor1788700000002 } from '../migrations/1788700000002-HriHashMonitor';
import { SourcesScheduler } from './sources.scheduler';
import type { RecordEventInput, SourceEventsService } from './source-events.service';
import type { SourcesNotifier } from './discord.notifier';
import type { Source } from './entities/source.entity';
import { confirmsRelease, missedReleases } from './missed-releases';
import type { EventLike } from './missed-releases';

/** SOC-R8 ■3 — hri_gshr: Last-Modified 흔들림을 발간으로 읽지 않는다. */

function scheduler() {
  const patches: Partial<Source>[] = [];
  const repo = {
    update: (_id: string, p: Partial<Source>) => (
      patches.push(p), Promise.resolve({ affected: 1 })
    ),
  } as unknown as Repository<Source>;
  const recorded: RecordEventInput[] = [];
  const events = {
    record: (e: RecordEventInput) => (recorded.push(e), Promise.resolve()),
  } as unknown as SourceEventsService;
  const notifier = { notify: () => Promise.resolve() } as unknown as SourcesNotifier;
  const sched = new SourcesScheduler(repo, notifier, events);
  const calls: string[] = [];
  const s = sched as unknown as {
    sleep: (ms: number) => Promise<void>;
    fetchPage: (s: Source, m: string) => Promise<unknown>;
  };
  s.sleep = () => Promise.resolve();
  s.fetchPage = (_src, m) => (
    calls.push(m),
    Promise.resolve({
      status: 200,
      ok: true,
      headers: {
        get: (h: string) =>
          h === 'last-modified' ? `Fri, 1${calls.length} Oct 2026 09:54:59 GMT` : null,
      },
      text: () =>
        Promise.resolve('<html><body><h1>Global State of Harm Reduction</h1></body></html>'),
    })
  );
  return { sched, calls, patches, recorded };
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
    lastCheckedAt: new Date('2026-10-18T00:00:00Z'),
    lastPublishedAt: '2025-12-03',
    nextExpectedAt: '2026-11-01',
    ...p,
  }) as unknown as Source;

describe('SOC-R8 ■3 hri_gshr hash monitor', () => {
  it('detect:hash skips the HEAD validators: GET body hash only, first read is a baseline, the same body is unchanged', async () => {
    const { sched, calls, patches, recorded } = scheduler();
    const first = await sched.monitorSources([hri()]);
    expect(calls).toEqual(['GET']);
    expect(first).toEqual([{ id: 'hri_gshr', status: 'unchanged', method: 'hash' }]);
    const hash = patches[0].contentHash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(patches[0].lastModified).toBeUndefined();

    // 다음 날: Last-Modified 가 바뀌어도(가짜 fetch 는 호출마다 다른 값) 본문이 같으면 그대로
    const again = await sched.monitorSources([hri({ contentHash: hash })]);
    expect(again[0].status).toBe('unchanged');
    expect(recorded.map((r) => r.eventType)).toEqual(['checked', 'checked']);

    // detect 가 없는 출처는 예전처럼 HEAD Last-Modified
    const other = scheduler();
    const lm = await other.sched.monitorSources([
      hri({ id: 'x', accessDetail: null, lastModified: 'old' }),
    ]);
    expect(other.calls).toEqual(['HEAD']);
    expect(lm[0]).toMatchObject({ status: 'changed', method: 'last-modified' });
  });

  it('migration switches hri once (guarded, baseline cleared) with a source_updated event; seed carries the same setting', async () => {
    const run = async (n: number) => {
      const sql: { q: string; p: unknown[] }[] = [];
      const runner = {
        query: (q: string, p: unknown[]) => {
          sql.push({ q, p });
          return Promise.resolve(
            q.startsWith('UPDATE')
              ? [Array.from({ length: n }, () => ({})), n]
              : [],
          );
        },
      } as unknown as QueryRunner;
      await new HriHashMonitor1788700000002().up(runner);
      return sql;
    };
    const first = await run(1);
    expect(first).toHaveLength(2);
    expect(first[0].q).toContain("WHERE id = $1 AND (access_detail IS NULL OR access_detail->>'detect' IS NULL)");
    expect(first[0].q).toContain('last_modified = NULL');
    expect(first[0].q).toContain('content_hash = NULL');
    expect(first[0].q).not.toContain('last_checked_at');
    expect(first[0].p).toEqual(['hri_gshr', 'hash']);
    expect(first[1].q).toContain("'source_updated'");
    expect(JSON.parse(first[1].p[1] as string)).toMatchObject({
      field: 'accessDetail.detect',
      from: 'last-modified',
      to: 'hash',
      by: 'SOC-R8',
    });
    expect(await run(0)).toHaveLength(1); // 이미 바꿈 → 사건 0

    const seed = readFileSync(join(__dirname, 'seed', 'sources.seed.ts'), 'utf8');
    const row = seed.slice(seed.indexOf("id: 'hri_gshr'"), seed.indexOf("id: 'hri_gshr'") + 600);
    expect(row).toContain("accessDetail: { detect: 'hash' }");
  });

  it('a Last-Modified/ETag change no longer confirms a release; hash, board and published still do', () => {
    const ev = (eventType: string, method?: string): EventLike => ({
      sourceId: 'hri_gshr',
      eventType,
      detectedAt: '2026-11-20T00:00:00Z',
      detail: method ? { method, cooldown: true } : {},
    });
    expect(confirmsRelease(ev('changed', 'last-modified'))).toBe(false);
    expect(confirmsRelease(ev('changed', 'etag'))).toBe(false);
    expect(confirmsRelease(ev('changed', 'hash'))).toBe(true);
    expect(confirmsRelease(ev('changed', 'board-latest'))).toBe(true);
    expect(confirmsRelease(ev('published', 'last-modified'))).toBe(true);
    expect(confirmsRelease(ev('checked', 'hash'))).toBe(false);

    // 12-01 09:00: 11월 예정이 지나 이월 — 그 뒤 last-modified changed 가 있어도 줄은 남는다
    const src = hri({ nextExpectedAt: '2027-11-01' });
    const roll: EventLike = {
      sourceId: 'hri_gshr',
      eventType: 'rescheduled',
      detectedAt: '2026-12-01T00:00:30Z',
      detail: { from: '2026-11-01', to: '2027-11-01', reason: 'overdue' },
    };
    const read: EventLike = {
      sourceId: 'hri_gshr',
      eventType: 'checked',
      detectedAt: '2026-12-01T00:00:05Z',
      detail: { method: 'hash' },
    };
    const lmChange = { ...ev('changed', 'last-modified'), detectedAt: '2026-12-02T00:00:00Z' };
    const today = new Date('2026-12-02T03:00:00Z');
    expect(missedReleases([src], [read, roll, lmChange], today)).toEqual([
      expect.objectContaining({ expected: '2026-11', next: '2027-11' }),
    ]);
    const hashChange = { ...ev('changed', 'hash'), detectedAt: '2026-12-02T00:00:00Z' };
    expect(missedReleases([src], [read, roll, hashChange], today)).toEqual([]);
  });
});
