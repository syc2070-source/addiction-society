import { readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner } from 'typeorm';
import { readEnvelope } from './card-envelope';
import {
  DOI_LINK_RE,
  doiLinkOf,
  guestResponse,
  guestView,
  isGuestVisible,
  readCardLine,
  readCardLines,
  type InboxLine,
  type InboxRowView,
} from './eco-inbox';
import { KciDoiLink1789100000000 } from '../migrations/1789100000000-KciDoiLink';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

/** 받은 줄 → 저장된 행처럼(검수 keep · public) */
const rowOf = (
  l: InboxLine,
  id: number,
  extra: Partial<InboxRowView> = {},
): InboxRowView => ({
  id,
  origin: l.origin,
  slug: l.slug,
  version: l.version,
  paperKey: l.paperKey,
  title: l.title,
  url: l.url,
  grade: l.grade,
  kind: l.kind,
  subtype: l.subtype,
  topic: l.topic,
  licence: l.licence,
  missing: l.missing,
  upstream: 'public',
  reviewDecision: 'keep',
  reviewedBy: 'owner',
  reviewedAt: new Date('2026-11-04T00:00:00Z'),
  keepFromVersion: null,
  keyMovedFrom: null,
  payload: l.payload,
  ...extra,
});

const kciCard = (over: Record<string, unknown>) => ({
  card_id: 'k1',
  card_version: 'paper-card-struct-v1',
  paper_id: 'kci-item-k1',
  title: '국내 논문',
  source: 'kci',
  ...over,
});

const NOW = new Date('2026-11-05T00:00:00Z');

describe('DOI 만 있는 KCI 카드 = doi.org 링크 (SOC-R18 ■1)', () => {
  it('fills url with https://doi.org/<DOI>, keeps the source_url missing marker, and shows the card to guests', () => {
    const r = readCardLine(
      kciCard({ doi: '10.0000/kci.2024.0003', quote: '하나. 둘. 셋.' }),
    );
    expect(r.reject).toBeNull();
    expect(r.line!.url).toBe('https://doi.org/10.0000/kci.2024.0003');
    expect(r.line!.missing).toEqual(['source_url']);
    const g = guestResponse([rowOf(r.line!, 1)], NOW);
    expect(g.items).toEqual([
      expect.objectContaining({
        url: 'https://doi.org/10.0000/kci.2024.0003',
        source: 'kci',
        quote: '하나. 둘.',
        keyFindings: null,
      }),
    ]);
    // 출처 줄은 KCI 항목이 보일 때만(그대로)
    expect(g.credit!.ko).toBe('KCI(한국학술지인용색인) 데이터 활용');
    // source_url 이 있으면 그 링크 그대로(DOI 로 덮지 않음)
    const both = readCardLine(
      kciCard({ doi: '10.0000/kci.1', source_url: 'https://www.kci.go.kr/a' }),
    );
    expect(both.line!.url).toBe('https://www.kci.go.kr/a');
  });

  it('a DOI that is not in the link form builds no link (url empty · marker kept · not refused); non-KCI cards are unchanged', () => {
    for (const bad of [
      '10.1/kci',
      '10.1234/a b',
      '10.1234/a#b',
      '10.1234/a?x=1',
    ]) {
      expect(doiLinkOf(bad)).toBeNull();
      const r = readCardLine(kciCard({ doi: bad }));
      if (bad.startsWith('10.')) expect(r.reject).toBeNull();
      expect(r.line!.url).toBeNull();
      expect(isGuestVisible(rowOf(r.line!, 1), NOW)).toBe(false);
    }
    expect(doiLinkOf(null)).toBeNull();
    expect(DOI_LINK_RE.test('10.1016/j.chb.2025.0100')).toBe(true);
    // KCI 아닌 카드는 여전히 source_url 이 있어야 함
    expect(
      readCardLine(kciCard({ source: undefined, doi: '10.1016/j.x' })).reject,
    ).toBe('source_url_invalid');
  });

  it('v1.7 rehearsal: the DOI-only card now shows, the link-less one still does not (guests 3 of 4)', () => {
    const read = readCardLines(
      readEnvelope(fixture('statory-export-v17.json')),
    );
    const g = guestResponse(
      read.lines.map((l, i) => rowOf(l, i + 1)),
      NOW,
    );
    expect(g.items.map((i) => [i.slug, i.url])).toEqual([
      [
        'statory:card:v17-card-plain',
        'https://doi.org/10.1016/j.chb.2025.0100',
      ],
      ['statory:card:v17-card-kci-url', expect.stringMatching(/^https:\/\//)],
      [
        'statory:card:v17-card-kci-doi',
        'https://doi.org/10.0000/kci.2024.0003',
      ],
    ]);
  });

  it('migration fills url once for stored DOI-only KCI rows (url NULL only · same DOI form · counted) and nothing else', async () => {
    const sql: { q: string; p: unknown[] }[] = [];
    const logs: string[] = [];
    const spy = jest
      .spyOn(console, 'log')
      .mockImplementation((...a: unknown[]) => void logs.push(a.join(' ')));
    const runner = {
      query: (q: string, p: unknown[] = []) => {
        sql.push({ q, p });
        return Promise.resolve([[{ id: 3 }, { id: 9 }], 2]);
      },
    } as unknown as QueryRunner;
    await new KciDoiLink1789100000000().up(runner);
    spy.mockRestore();
    expect(sql).toHaveLength(1);
    const [{ q, p }] = sql;
    expect(q).toContain('UPDATE "eco_inbox"');
    expect(q).toContain(
      `SET "url" = 'https://doi.org/' || btrim("payload"->>'doi')`,
    );
    expect(q).toContain('"url" IS NULL');
    expect(q).toContain(`"origin" = 'statory'`);
    expect(q).toContain(`lower(btrim("payload"->>'source')) = 'kci'`);
    expect(q).not.toMatch(/review_decision|reviewed_|upstream|DELETE/);
    // SQL 꼴 = DOI_LINK_RE 와 같은 판정(표본마다)
    const sqlRe = new RegExp(p[0] as string);
    for (const d of [
      '10.0000/kci.2024.0003',
      '10.1016/j.chb.2025.0100',
      '10.1234/(a);b:c',
      '10.1/kci',
      '10.1234/a b',
      '10.1234/a#b',
      '10.12345678901/x',
    ]) {
      expect(sqlRe.test(d)).toBe(DOI_LINK_RE.test(d));
    }
    expect(logs.join('\n')).toContain('2');
    // 손님 응답의 표 전체 KCI 열쇠는 넓게(「kci\n」 따위도 · 반박 A1) — 넘쳐도 좁히는 쪽
    const svc = readFileSync(join(__dirname, 'eco-inbox.service.ts'), 'utf8');
    expect(svc).toContain('position($2 in lower("payload"->>$1)) > 0');
    // 받는 문도 같은 규칙: 결정이 있는 KCI 행에 링크가 생기면 빈 url 만 채움(덮지 않음)
    const importEco = readFileSync(
      join(__dirname, 'seed', 'import-eco.ts'),
      'utf8',
    );
    expect(importEco).toContain(
      'UPDATE "eco_inbox" SET "url" = $2 WHERE "id" = $1 AND "url" IS NULL',
    );
    // 내리기는 아무것도 하지 않음(링크를 다시 비우지 않음)
    await expect(new KciDoiLink1789100000000().down()).resolves.toBeUndefined();
    const mig = readFileSync(
      join(__dirname, '..', 'migrations', '1789100000000-KciDoiLink.ts'),
      'utf8',
    );
    expect(mig.slice(mig.indexOf('down('))).not.toContain('query(');
  });
});

describe('계약 §5-2 대조 (SOC-R18 ■4 · Statory evidenceExportCore buildExportRow 10-27 실측)', () => {
  /** Statory buildExportRow 가 내는 24칸 그대로(값만 지어 넣음) */
  const statoryRow = (over: Record<string, unknown>) => ({
    title: '국내 논문',
    authors: ['김'],
    year: 2024,
    venue: '학회지',
    doi: null,
    population: null,
    region: null,
    addiction_type: null,
    design: null,
    sample: null,
    key_findings: null,
    limitations: null,
    related_indicators: null,
    statory_page_url: null,
    source_url: null,
    license: 'unknown',
    judged_at: '2026-10-26T00:00:00Z',
    card_version: 'paper-card-v3.3',
    license_use: null,
    card_id: 'c1',
    paper_id: 'i1',
    generated_at: '2026-10-27T00:00:00Z',
    source: 'kci',
    fields_missing: ['doi', 'region'],
    ...over,
  });

  it('every Statory key is a known receiving key (only related_indicators is ours); KCI DOI-only arrives with the doi.org link Statory built', () => {
    expect(Object.keys(statoryRow({}))).toHaveLength(24);
    const viaStatory = readCardLine(
      statoryRow({
        doi: '10.0000/kci.7',
        source_url: 'https://doi.org/10.0000/kci.7',
      }),
    );
    expect(viaStatory.reject).toBeNull();
    expect(viaStatory.unreceived).toEqual([
      { key: 'related_indicators', why: 'ours' },
    ]);
    expect(viaStatory.line!.url).toBe('https://doi.org/10.0000/kci.7');
    // Statory 는 KCI 줄의 핵심 발견을 비워 보냄 · use_until · quote 는 내보내지 않음 → 인용 없음 · 기간 끝 없음(Statory 가 지난 줄을 거름)
    expect(viaStatory.line!.payload).not.toHaveProperty('quote');
    expect(viaStatory.line!.payload).not.toHaveProperty('use_until');
    // KCI 상세 링크가 오면 그것
    const kciLink = readCardLine(
      statoryRow({ source_url: 'https://www.kci.go.kr/x' }),
    );
    expect(kciLink.line!.url).toBe('https://www.kci.go.kr/x');
    // KCI 아닌 줄 = DOI 필수(Statory skipReasonOf 와 같은 잣대) · Statory 는 source_url 을 doi.org 로 지어 보냄
    const plain = readCardLine(
      statoryRow({
        source: null,
        doi: '10.1016/j.x',
        source_url: 'https://doi.org/10.1016/j.x',
        key_findings: ['발견'],
      }),
    );
    expect(plain.reject).toBeNull();
    expect(readCardLine(statoryRow({ source: null })).reject).toBe(
      'doi_missing',
    );
  });
});

describe('안 보이는 판은 옛 판을 가리지 않는다 · 보이는 최신 판 (SOC-R18 ■2)', () => {
  const plainLine = readCardLine({
    card_id: 'p-old',
    card_version: 'v1',
    paper_id: 'item-p',
    title: '옛 판',
    doi: '10.1016/j.old',
    source_url: 'https://doi.org/10.1016/j.old',
    license: 'cc-by',
    key_findings: ['발견'],
  }).line!;
  const old = rowOf(plainLine, 1);
  const newerPlain = rowOf(
    { ...plainLine, slug: 'statory:card:p-new', version: 'v2', title: '새 판' },
    2,
  );
  const kciNew = rowOf(
    readCardLine(
      kciCard({ card_id: 'p-kci', paper_id: 'item-p', doi: '10.0000/kci.9' }),
    ).line!,
    2,
  );
  expect(kciNew.paperKey).toBe(old.paperKey);

  /** 표본 5 — 새 판이 안 보이는 다섯 꼴 */
  const samples: [string, InboxRowView][] = [
    ['1 newer withdrawn', { ...newerPlain, upstream: 'withdrawn' }],
    ['2 newer hidden by a person', { ...newerPlain, reviewDecision: 'hide' }],
    ['3 newer still held', { ...newerPlain, reviewDecision: null }],
    ['4 newer KCI withdrawn', { ...kciNew, upstream: 'withdrawn' }],
    ['5 newer KCI without a link', { ...kciNew, url: null }],
  ];

  it.each(samples)(
    '%s → the older visible version still shows',
    (_n, newer) => {
      const kciKeys = newer.payload.source === 'kci' ? [newer.paperKey] : [];
      const items = guestView([newer, old], NOW, kciKeys);
      expect(items.map((i) => i.slug)).toEqual([old.slug]);
      // 그 논문에 KCI 판이 있으면 옛 판은 좁혀서(제목 + 링크 · 발견 0 · KCI 규칙을 비켜 서지 않게)
      expect(items[0].keyFindings).toEqual(kciKeys.length ? null : ['발견']);
      expect(guestResponse([newer, old], NOW, kciKeys).credit).toBeNull();
    },
  );

  it('when several versions are visible only the newest shows; a visible KCI version is preferred over a newer non-KCI one', () => {
    expect(guestView([newerPlain, old], NOW).map((i) => i.title)).toEqual([
      '새 판',
    ]);
    // KCI 판이 보이면 그 논문은 KCI 판 하나(옛 KCI 아닌 판은 더 늦게 받았어도 서지 않음 · R16 B2 그대로)
    const lateOld = { ...old, id: 5 };
    expect(guestView([lateOld, kciNew], NOW).map((i) => i.source)).toEqual([
      'kci',
    ]);
    // 다른 논문 · 중독뉴스 줄은 서로 가리지 않음
    const other = {
      ...old,
      id: 7,
      paperKey: 'paper:other',
      slug: 'statory:card:o',
    };
    expect(guestView([other, old], NOW)).toHaveLength(2);
  });
});
