import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner, Repository } from 'typeorm';
import { FixSourceMonitorUrls1788600000000 } from '../migrations/1788600000000-FixSourceMonitorUrls';
import {
  EUDA_STATBULLETIN_URL,
  KOCCA_GAME_URL,
  SOURCE_URL_FIXES_R6,
  updatedCount,
} from './source-url-fixes';
import { isDailyDue, SourcesScheduler } from './sources.scheduler';
import { SIGNIFICANT } from './source-events.service';
import type { RecordEventInput } from './source-events.service';
import type { SourceEventsService } from './source-events.service';
import type { SourcesNotifier } from './discord.notifier';
import type { Source } from './entities/source.entity';

/**
 * SOC-R6 ■1 — 감시 URL 수정. DB 없이 migration·감시를 가짜 저장소로 돌린다.
 */

const EDR_URL =
  'https://www.euda.europa.eu/publications/european-drug-report/2026_en';

/** 실측(2026-10-16) kocca.kr B0000147 「게임이용자 실태조사」 검색 목록 표 구조 그대로(행 2개만) */
const KOCCA_LIST_HTML = `
<table><thead><tr><th scope="col">번호</th><th scope="col">제목</th><th scope="col">첨부</th><th scope="col">등록일</th><th scope="col">조회수</th></tr></thead>
<tbody>
  <tr>
    <td data-label="번호">1801</td>
    <td data-label="제목">
      <a href="/kocca/bbs/view/B0000147/2010445.do?menuNo=204153">
        2025 게임이용자 실태조사
      </a>
    </td>
    <td data-label="첨부"><img alt="첨부파일 있음"/></td>
    <td data-label="등록일">2025-12-18</td>
    <td data-label="조회수">5821</td>
  </tr>
  <tr>
    <td data-label="번호">1500</td>
    <td data-label="제목"><a href="#">2022 게임이용자 실태조사</a></td>
    <td data-label="첨부"></td>
    <td data-label="등록일">2022-08-31</td>
    <td data-label="조회수">9000</td>
  </tr>
</tbody></table>`;

function fakeRunner(rowsMatched: number[]) {
  const sql: { q: string; p: unknown[] }[] = [];
  let i = 0;
  const runner = {
    query: (q: string, p: unknown[]) => {
      sql.push({ q, p });
      if (q.startsWith('UPDATE')) {
        const n = rowsMatched[i++] ?? 0;
        return Promise.resolve([Array.from({ length: n }, () => ({})), n]);
      }
      return Promise.resolve([]);
    },
  } as unknown as QueryRunner;
  return { runner, sql };
}

describe('SOC-R6 ■1 source monitor URL fixes', () => {
  it('moves only the two broken URLs, once, each with a source_updated{from,to,reason} event', async () => {
    // 고친 뒤 kocca·statbulletin·edr 세 주소가 모두 다르고, edr 은 그대로
    const ids = SOURCE_URL_FIXES_R6.map((f) => f.id);
    expect(ids).toEqual(['kocca_game', 'euda_statbulletin']);
    expect(ids).not.toContain('euda_edr');
    expect(new Set([KOCCA_GAME_URL, EUDA_STATBULLETIN_URL, EDR_URL]).size).toBe(3);
    for (const f of SOURCE_URL_FIXES_R6) expect(f.to).not.toBe(f.from);

    // seed 도 같은 주소를 쓴다(새 DB · seed_diff 0)
    const seedSrc = readFileSync(join(__dirname, 'seed', 'sources.seed.ts'), 'utf8');
    expect(seedSrc).not.toContain("'https://welcon.kocca.kr/'");
    expect(seedSrc.split(EDR_URL).length - 1).toBe(1); // euda_edr 하나만

    // 첫 실행: 두 행 모두 옛 주소 → UPDATE 2 + 사건 2
    const m = new FixSourceMonitorUrls1788600000000();
    const first = fakeRunner([1, 1]);
    await m.up(first.runner);
    const updates = first.sql.filter((s) => s.q.startsWith('UPDATE'));
    const inserts = first.sql.filter((s) => s.q.startsWith('INSERT'));
    expect(updates).toHaveLength(2);
    expect(inserts).toHaveLength(2);
    for (const u of updates) {
      expect(u.q).toContain('WHERE id = $1 AND url = $3'); // 옛 주소일 때만
      expect(u.q).toContain('last_checked_at = NULL'); // 다음 09:00 첫 읽기
      expect(u.q).toContain('content_hash = NULL');
      expect(u.q).not.toMatch(/observations|indicators/);
    }
    const detail = JSON.parse(inserts[0].p[1] as string);
    expect(inserts[0].q).toContain("'source_updated'");
    expect(detail).toMatchObject({
      from: 'https://welcon.kocca.kr/',
      to: KOCCA_GAME_URL,
      reason: expect.any(String),
    });
    expect(JSON.parse(updates[0].p[3] as string)).toEqual({
      board: expect.objectContaining({ row: 'table tbody tr' }),
    });
    expect(updates[1].p).toHaveLength(3); // statbulletin: access_detail 그대로

    // 두 번째 실행(이미 고침): UPDATE 0 → 사건 0
    const again = fakeRunner([0, 0]);
    await m.up(again.runner);
    expect(again.sql.filter((s) => s.q.startsWith('INSERT'))).toHaveLength(0);
    expect(updatedCount([[], 0])).toBe(0);
    expect(SIGNIFICANT).toContain('source_updated');
  });

  it('the new KOCCA board baseline is the latest Game User Survey row (title + date), stored as checked', async () => {
    const patches: Partial<Source>[] = [];
    const repo = {
      update: (_id: string, patch: Partial<Source>) => {
        patches.push(patch);
        return Promise.resolve({ affected: 1 });
      },
    } as unknown as Repository<Source>;
    const recorded: RecordEventInput[] = [];
    const events = {
      record: (e: RecordEventInput) => (recorded.push(e), Promise.resolve()),
    } as unknown as SourceEventsService;
    const notifier = {
      notify: () => Promise.resolve(),
    } as unknown as SourcesNotifier;
    const sched = new SourcesScheduler(repo, notifier, events);
    const s = sched as unknown as {
      sleep: (ms: number) => Promise<void>;
      fetchPage: (s: Source, m: string) => Promise<unknown>;
    };
    s.sleep = () => Promise.resolve();
    const urls: string[] = [];
    s.fetchPage = (src, m) => (
      urls.push(`${m} ${src.url}`),
      Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: () => null },
        text: () => Promise.resolve(KOCCA_LIST_HTML),
      })
    );
    const fix = SOURCE_URL_FIXES_R6[0];
    const kocca = {
      id: 'kocca_game',
      url: fix.to,
      accessMethod: 'pdf',
      accessDetail: fix.accessDetail,
      cadence: 'annual',
      expectedMonth: [12],
      status: 'active',
      failCount: 0,
      contentHash: null, // migration 이 비움
      lastCheckedAt: null,
      lastPublishedAt: '2025-12-18',
      nextExpectedAt: '2026-12-01',
    } as unknown as Source;

    const res = await sched.monitorSources([kocca]);
    expect(urls).toEqual([`GET ${KOCCA_GAME_URL}`]); // 게시판 감지 = GET 한 번
    expect(res).toEqual([
      { id: 'kocca_game', status: 'unchanged', method: 'board-latest' },
    ]);
    expect(patches[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(patches[0].lastPublishedAt).toBe('2025-12-18');
    expect(recorded.map((r) => r.eventType)).toEqual(['checked']);
  });

  it('after the fix the source joins the next 09:00 run once as a first read, then not again', () => {
    const base = {
      lastCheckedAt: null,
      nextExpectedAt: '2026-12-01',
    } as Pick<Source, 'lastCheckedAt' | 'nextExpectedAt'>;
    // 10-17 09:00 회차: 오늘+30 = 2026-11-16 → 예정일로는 대상 아님 · 첫 읽기라 대상
    expect(isDailyDue(base, '2026-11-16')).toBe(true);
    // 읽은 뒤(성공·실패 무관 lastCheckedAt 채움) 10-18 회차엔 빠짐
    const after = { ...base, lastCheckedAt: new Date('2026-10-17T00:00:05Z') };
    expect(isDailyDue(after, '2026-11-17')).toBe(false);
    // 11-01 이후(오늘+30 ≥ 12-01)엔 예정일 규칙으로 다시 매일
    expect(isDailyDue(after, '2026-12-01')).toBe(true);
    // statbulletin(예정 2027-06-01)도 같은 규칙
    expect(
      isDailyDue({ lastCheckedAt: null, nextExpectedAt: '2027-06-01' }, '2026-11-16'),
    ).toBe(true);
  });
});
