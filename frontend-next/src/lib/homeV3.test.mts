// SOC-R20 ■2 · ■3 · ■5 — 주인공 규칙 · n배 · Statory 카드 읽기 규칙 · 현 대문이 묶음을 읽지 않음. 모델 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { heroRows, maxIndex, pickHero, ratioText } from './homeV3.ts';
import {
  SAMPLE_FILE,
  REAL_FILE,
  cardsOfType,
  excerptOf,
  leadCard,
  loadStatoryExport,
  parseExport,
  typeTiles,
  type EvidenceCard,
} from './statoryEvidence.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const statory = join(root, 'data', 'statory');
const S = (pairs: Array<[string, string]>) =>
  pairs.map(([period, value]) => ({ period, value }));

test('hero: largest |last − first| / first, broken series are not candidates', () => {
  const cands = [
    { type: 'alcohol', code: 'a', series: S([['2015', '13.0'], ['2024', '12.6']]), breakYears: null },
    { type: 'gambling', code: 'g', series: S([['2018', '6.4'], ['2024', '20.0']]), breakYears: [2020, 2022] },
    { type: 'drug', code: 'd', series: S([['2015', '11916'], ['2023', '27611'], ['2025', '23403']]), breakYears: null },
    { type: 'game', code: 'm', series: S([['2016', '70.3'], ['2025', '59.9']]), breakYears: [2023] },
    { type: 'tobacco', code: 't', series: S([['2015', '22.6']]), breakYears: null },
  ];
  const hero = pickHero(cands);
  assert.equal(hero?.type, 'drug');
  const rows = heroRows(cands);
  assert.deepEqual(
    rows.map((r) => [r.type, r.excluded]),
    [['alcohol', null], ['gambling', 'break'], ['drug', null], ['game', 'break'], ['tobacco', 'points']],
  );
  // 단절이 시계열 밖이면 단절 아님(seriesBreaks 와 같은 판정)
  assert.equal(
    pickHero([{ type: 'x', code: 'x', series: S([['2023', '1'], ['2024', '3']]), breakYears: [2020] }])?.type,
    'x',
  );
  assert.equal(pickHero([]), null);
});

test('n배 = stored last ÷ stored first, one decimal; max point is the first maximum', () => {
  assert.equal(ratioText('11916', '23403'), '2.0');
  assert.equal(ratioText('13.0', '12.6'), '1.0');
  assert.equal(ratioText('0', '5'), null);
  assert.equal(maxIndex([11916, 27611, 23403, 27611]), 1);
  assert.equal(maxIndex([]), -1);
});

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'soc-r20-'));
}

test('no export file → null (the section is not drawn at all)', () => {
  const dir = tmp();
  assert.equal(loadStatoryExport({ allowSample: true, dir }), null);
  // 견본만 있는 자리에서 견본을 허락하지 않으면(미리보기 밖) 없음
  if (!existsSync(join(statory, REAL_FILE))) {
    assert.equal(loadStatoryExport({ allowSample: false, dir: statory }), null);
  }
});

test('sample: 18 synthetic cards, 6 types × 3, Korea 10, six tiles', () => {
  const got = loadStatoryExport({ allowSample: true, dir: statory });
  assert.ok(got);
  assert.equal(got.mode, existsSync(join(statory, REAL_FILE)) ? 'real' : 'sample');
  const sample = parseExport(JSON.parse(readFileSync(join(statory, SAMPLE_FILE), 'utf8')));
  assert.ok(sample);
  assert.equal(sample.dropped, 0);
  assert.equal(sample.data.cards.length, 18);
  assert.equal(sample.data.cards.filter((c) => c.country === 'KR').length, 10);
  const tiles = typeTiles(sample.data);
  assert.deepEqual(
    tiles.map((t) => [t.type, t.n]),
    [['alcohol', 3], ['gambling', 3], ['drug', 3], ['smartphone', 3], ['game', 3], ['tobacco', 3]],
  );
  // 대표 = findings_ko 있음 · 발췌 허락 → 한국 우선 → approved_at 최신
  assert.equal(tiles[0].lead?.card_id, 'sample-alcohol-1');
  assert.equal(tiles[2].lead?.card_id, 'sample-drug-1');
  assert.equal(tiles[5].lead?.card_id, 'sample-tobacco-1');
  assert.deepEqual([tiles[0].yearFrom, tiles[0].yearTo, tiles[0].korea], [2019, 2024, 2]);
  // 쪽 목록 = 연도 내림
  assert.deepEqual(
    cardsOfType(sample.data, 'drug').map((c) => c.year),
    [2024, 2023, 2018],
  );
  // 견본은 실명·실제 제목 0 — 제목은 모두 견본 꼴
  for (const c of sample.data.cards) {
    assert.match(c.title, /^(견본 카드 · .+ \(합성\)|Sample card · .+ \(synthetic\))$/);
    assert.match(c.authors_short, /^(견본저자 |Sample author )/);
  }
});

test('real file present → sample is never read; broken real file → null, not sample', () => {
  const dir = tmp();
  copyFileSync(join(statory, SAMPLE_FILE), join(dir, SAMPLE_FILE));
  writeFileSync(
    join(dir, REAL_FILE),
    JSON.stringify({
      version: 'evidence_export_v1',
      exported_at: '2026-12-01T00:00:00Z',
      field: 'addiction',
      source: 'statory',
      cards: [{ card_id: 'r1', type: '마약', title: 'Real one', year: 2025, approved_at: '2026-11-30', license: 'cc_by' }],
    }),
  );
  const got = loadStatoryExport({ allowSample: true, dir });
  assert.equal(got?.mode, 'real');
  assert.equal(got?.data.cards.length, 1);
  writeFileSync(join(dir, REAL_FILE), '{"version":"other"}');
  assert.equal(loadStatoryExport({ allowSample: true, dir }), null);
});

const card = (o: Partial<EvidenceCard>): EvidenceCard => ({
  card_id: 'c',
  type: '알코올',
  title: 't',
  authors_short: 'a',
  year: 2024,
  country: 'KR',
  sample_n: null,
  design: 'other',
  instrument: null,
  findings_ko: null,
  findings_src: null,
  implications_ko: null,
  source_grade: null,
  license: 'cc_by',
  doi: null,
  url: null,
  approved_at: '2026-10-01',
  ...o,
});

test('empty findings_ko → source sentence with the (원문) tag; en shows English as is, Korean as a tag only', () => {
  const c = card({ findings_src: 'Source sentence.' });
  assert.deepEqual(excerptOf(c, 'ko'), { kind: 'text', text: 'Source sentence.', tag: 'source' });
  assert.deepEqual(excerptOf(c, 'en'), { kind: 'text', text: 'Source sentence.', tag: null });
  const kr = card({ findings_ko: '한글 발췌', findings_src: '한글 원문' });
  assert.deepEqual(excerptOf(kr, 'ko'), { kind: 'text', text: '한글 발췌', tag: null });
  assert.deepEqual(excerptOf(kr, 'en'), { kind: 'korean' });
  // 대표 문장은 findings_ko 가 있는 카드에서만
  assert.equal(leadCard([c]), null);
});

test('quote-only licence → no excerpt (title and source only); unknown licence reads as quote-only', () => {
  const q = card({ findings_ko: '발췌', findings_src: 'excerpt', license: 'quote_only' });
  assert.deepEqual(excerptOf(q, 'ko'), { kind: 'none' });
  assert.deepEqual(excerptOf(q, 'en'), { kind: 'none' });
  assert.equal(leadCard([q]), null);
  const parsed = parseExport({
    version: 'evidence_export_v1',
    exported_at: '2026-11-02',
    cards: [
      { card_id: 'u', type: '담배', title: 'x', year: 2020, approved_at: '2026-11-01', license: 'all rights reserved' },
      { card_id: 'bad', type: '커피', title: 'x', year: 2020, approved_at: '2026-11-01' },
    ],
  });
  assert.equal(parsed?.data.cards[0].license, 'quote_only');
  assert.equal(parsed?.dropped, 1);
});

function files(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : files(p, ext);
    return ext.test(f) ? [p] : [];
  });
}

test('current home and the public API never read the Statory export', () => {
  const home = readFileSync(join(root, 'src', 'app', '[locale]', 'page.tsx'), 'utf8');
  assert.ok(!/statoryEvidence|evidence_export/.test(home));
  const backend = files(join(root, '..', 'backend', 'src'), /\.ts$/);
  assert.ok(backend.length > 50);
  for (const f of backend) {
    assert.ok(!readFileSync(f, 'utf8').includes('evidence_export_v1'), f);
  }
});

// 지금 대문에는 R12 부터 「Statory 서재가 Europe PMC 서지에서 센 수」(home.mapDesc)가 있다 — 그 줄은 그대로 두고,
// 이 판이 새로 만든 글(견본 띠 · 서재 카드 섹션 머리)이 대문에 새지 않는지만 본다.
test('built current home (ko · en) has no 견본 / sample band / Statory card section strings', (t) => {
  const app = join(root, '.next', 'server', 'app');
  const pages = [join(app, 'ko.html'), join(app, 'en.html')].filter((f) => existsSync(f));
  if (pages.length === 0) {
    t.skip('no build output (run npm run build)');
    return;
  }
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    for (const s of [
      '견본',
      'Sample data',
      'Statory 서재에서 읽기 전용',
      'Read-only from the Statory library',
      '연구는 무엇을 말하나',
      'What the research says',
      'evidence_export',
    ]) {
      assert.ok(!html.includes(s), `${f}: ${s}`);
    }
  }
});
