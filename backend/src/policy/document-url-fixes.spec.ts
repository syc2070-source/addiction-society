import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner } from 'typeorm';
import { FixSourceDocumentUrls1788700000000 } from '../migrations/1788700000000-FixSourceDocumentUrls';
import { diffFields } from '../common/seed-insert-only';
import { SOURCE_URL_FIXES_R6 } from '../sources/source-url-fixes';
import { SIGNIFICANT } from '../sources/source-events.service';
import {
  READ_FAIL_EVENTS,
  READ_OK_EVENTS,
  missedReleases,
} from '../sources/missed-releases';
import type { Source } from '../sources/entities/source.entity';
import { DOCUMENT_URL_FIXES_R8, returnedIds } from './document-url-fixes';

/** SOC-R8 ■1 — 대표 문서 주소 둘. DB 없이 migration 을 가짜 실행기로 돌린다. */

function fakeRunner(returned: number[][]) {
  const sql: { q: string; p: unknown[] }[] = [];
  let i = 0;
  const runner = {
    query: (q: string, p: unknown[]) => {
      sql.push({ q, p });
      if (q.startsWith('UPDATE')) {
        const rows = (returned[i++] ?? []).map((id) => ({ id }));
        return Promise.resolve([rows, rows.length]);
      }
      return Promise.resolve([]);
    },
  } as unknown as QueryRunner;
  return { runner, sql };
}

describe('SOC-R8 ■1 representative document URLs', () => {
  it('moves only the two documents still on the pre-R6 URLs, once, each with a document_updated event', async () => {
    expect(DOCUMENT_URL_FIXES_R8.map((f) => f.sourceId)).toEqual([
      'kocca_game',
      'euda_statbulletin',
    ]);
    // 감시 URL 수정(R6)과 같은 from → to
    for (const f of DOCUMENT_URL_FIXES_R8) {
      const r6 = SOURCE_URL_FIXES_R6.find((x) => x.id === f.sourceId);
      expect(r6).toBeDefined();
      expect([f.from, f.to]).toEqual([r6!.from, r6!.to]);
    }

    const m = new FixSourceDocumentUrls1788700000000();
    const first = fakeRunner([[18], [12]]); // 운영 doc 18 · doc 12
    await m.up(first.runner);
    const updates = first.sql.filter((s) => s.q.startsWith('UPDATE'));
    const inserts = first.sql.filter((s) => s.q.startsWith('INSERT'));
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.q).toContain('UPDATE documents SET source_url = $2');
      expect(u.q).toContain('WHERE source_id = $1 AND source_url = $3'); // 옛 주소일 때만
      expect(u.q).not.toMatch(/sources|observations|indicators/);
    }
    expect(inserts).toHaveLength(2);
    expect(inserts[0].q).toContain("'document_updated'");
    expect(inserts[0].p[0]).toBe('kocca_game');
    expect(JSON.parse(inserts[0].p[1] as string)).toMatchObject({
      documentId: 18,
      field: 'sourceUrl',
      from: 'https://welcon.kocca.kr/',
      to: DOCUMENT_URL_FIXES_R8[0].to,
      by: 'SOC-R8',
    });
    expect(JSON.parse(inserts[1].p[1] as string)).toMatchObject({
      documentId: 12,
    });

    // 다시 돌리면(이미 고침) UPDATE 0행 → 사건 0
    const again = fakeRunner([[], []]);
    await m.up(again.runner);
    expect(again.sql.filter((s) => s.q.startsWith('INSERT'))).toHaveLength(0);
    expect(returnedIds([[{ id: 3 }], 1])).toEqual([3]);
    expect(returnedIds([])).toEqual([]);
  });

  it('seed:documents builds sourceUrl from the source row, so after the fix the two rows have seed_diff 0', () => {
    const seed = readFileSync(
      join(__dirname, 'seed', 'documents.seed.ts'),
      'utf8',
    );
    expect(seed).toContain('sourceUrl: s.url');
    for (const f of DOCUMENT_URL_FIXES_R8) {
      // 수정 전: sourceUrl 1건 다름(R7 ■0 diff 1) · 수정 후: 0
      expect(
        diffFields({ sourceUrl: f.from }, { sourceUrl: f.to }).map(
          (d) => d.field,
        ),
      ).toEqual(['sourceUrl']);
      expect(diffFields({ sourceUrl: f.to }, { sourceUrl: f.to })).toEqual([]);
    }
  });

  it('the event shows on the timeline with ko/en labels and never counts as a read or a release', () => {
    expect('document_updated'.length).toBeLessThanOrEqual(20); // event_type varchar(20)
    expect(SIGNIFICANT).toContain('document_updated');
    expect(READ_OK_EVENTS).not.toContain('document_updated');
    expect(READ_FAIL_EVENTS).not.toContain('document_updated');
    for (const lang of ['ko', 'en']) {
      const msg = JSON.parse(
        readFileSync(
          join(
            __dirname,
            '..',
            '..',
            '..',
            'frontend-next',
            'messages',
            `${lang}.json`,
          ),
          'utf8',
        ),
      ) as { timelinePage: { event: Record<string, string> } };
      expect(msg.timelinePage.event.document_updated).toBeTruthy();
    }
    // 지난 예정 줄: document_updated 는 발간 확인도 읽기도 아니다 → 「확인 전」 그대로
    const src = {
      id: 'kocca_game',
      titleKo: 'x',
      titleEn: 'x',
      orgKo: 'x',
      org: 'x',
      url: 'u',
      accessMethod: 'pdf',
      status: 'active',
      cadence: 'annual',
      expectedMonth: [9],
      nextExpectedAt: '2026-09-01',
    } as unknown as Source;
    const rows = missedReleases(
      [src],
      [
        {
          sourceId: 'kocca_game',
          eventType: 'document_updated',
          detectedAt: '2026-10-18T05:00:00Z',
          detail: {},
        },
      ],
      new Date('2026-10-18T06:00:00Z'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].monitor).toBe('unchecked');
  });
});
