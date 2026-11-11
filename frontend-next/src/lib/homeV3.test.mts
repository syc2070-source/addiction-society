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
import { visibleTexts } from './enHangulGate.ts';
import {
  REAL_FILE,
  cardsOfType,
  excerptOf,
  leadCard,
  loadStatoryExport,
  parseExport,
  quoteOnlyClip,
  shortQuote,
  typeTiles,
  typesWithCards,
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

// SOC-R23 ■1: 견본 카드 길을 지움 — 합성 18장은 시험 자리(fixtures)에만 남는다.
const SYNTHETIC = join(root, 'src', 'lib', 'fixtures', 'statory_synthetic_18.json');

test('no export file → null (the section is not drawn at all); the sample path is gone', () => {
  const dir = tmp();
  assert.equal(loadStatoryExport({ dir }), null);
  // 옛 견본 파일 이름이 자리에 있어도 읽지 않는다
  copyFileSync(SYNTHETIC, join(dir, 'evidence_export_v1.sample.json'));
  assert.equal(loadStatoryExport({ dir }), null);
  assert.ok(!existsSync(join(statory, 'evidence_export_v1.sample.json')));
});

test('synthetic fixture: 18 cards, 6 types × 3, Korea 10, six tiles', () => {
  const sample = parseExport(JSON.parse(readFileSync(SYNTHETIC, 'utf8')));
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

test('real file is read; broken real file → null', () => {
  const dir = tmp();
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
  const got = loadStatoryExport({ dir });
  assert.equal(got?.data.cards.length, 1);
  writeFileSync(join(dir, REAL_FILE), '{"version":"other"}');
  assert.equal(loadStatoryExport({ dir }), null);
});

const card = (o: Partial<EvidenceCard>): EvidenceCard => ({
  card_id: 'c',
  type: '알코올',
  types: [],
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

test('en lead card: prefers a card en can show (English source sentence, English authors); ko keeps Korea first', () => {
  const krOnly = card({ card_id: 'k', country: 'KR', authors_short: '홍길동 외', findings_ko: '한글 발췌' });
  const intl = card({ card_id: 'i', country: 'US', authors_short: 'Smith et al.', findings_ko: '한글 발췌', findings_src: 'An English sentence.' });
  assert.equal(leadCard([krOnly, intl])?.card_id, 'k');
  assert.equal(leadCard([krOnly, intl], 'ko')?.card_id, 'k');
  assert.equal(leadCard([krOnly, intl], 'en')?.card_id, 'i');
  // en 에 실을 카드가 없으면 기본 규칙 그대로(꼬리표)
  assert.equal(leadCard([krOnly], 'en')?.card_id, 'k');
});

test('quote-only licence → library summary only, first two sentences and ≤300 chars, never the source text; not a tile lead; unknown licence reads as quote-only', () => {
  // R22 판 3: findings_ko(서재 요약)만 · 두 문장 · 300자 · findings_src 0
  const q = card({ findings_ko: '첫째다. 둘째다. 셋째다.', findings_src: 'Source excerpt.', license: 'quote_only' });
  assert.deepEqual(excerptOf(q, 'ko'), { kind: 'text', text: '첫째다. 둘째다.', tag: null });
  assert.deepEqual(excerptOf(q, 'en'), { kind: 'korean' });
  assert.deepEqual(excerptOf(card({ findings_src: 'Source excerpt.', license: 'quote_only' }), 'en'), { kind: 'none' });
  const long1 = `${'가'.repeat(200)}다. ${'나'.repeat(150)}다.`;
  assert.equal(quoteOnlyClip(long1), `${'가'.repeat(200)}다.`); // 두 문장 > 300 → 첫 문장
  const long2 = `${'가'.repeat(400)}다.`;
  assert.equal(quoteOnlyClip(long2).length, 300); // 한 문장 > 300 → 299자 + …
  assert.ok(quoteOnlyClip(long2).endsWith('…'));
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

// R22 ■2: 대문 = HomeV4(mode 'home') — Statory 는 실물만 읽고 견본은 읽지 않는다(R20 「대문은 묶음을 읽지 않음」을 바꿈).
test('public home reads only the real Statory export (never the sample); the public API never reads it', () => {
  const home = readFileSync(join(root, 'src', 'app', '[locale]', 'page.tsx'), 'utf8');
  assert.match(home, /<HomeV4[^>]*mode="home"/);
  const v4 = readFileSync(join(root, 'src', 'app', '[locale]', 'preview', 'home', 'HomeV4.tsx'), 'utf8');
  assert.match(v4, /loadStatoryExport\(\)/);
  assert.ok(!/allowSample|sampleBand/.test(v4));
  // 레이아웃이 messages/{locale}.json 전부를 모든 쪽 응답에 싣는다 → 견본 글은 messages/preview 에만
  for (const lang of ['ko', 'en']) {
    const all = readFileSync(join(root, 'messages', `${lang}.json`), 'utf8');
    for (const s of ['견본', 'Sample data', 'sampleBand']) {
      assert.ok(!all.includes(s), `messages/${lang}.json: ${s}`);
    }
  }
  const backend = files(join(root, '..', 'backend', 'src'), /\.ts$/);
  assert.ok(backend.length > 50);
  for (const f of backend) {
    assert.ok(!readFileSync(f, 'utf8').includes('evidence_export_v1'), f);
  }
});

// R22 ■1 · ■2: 빌드된 대문(ko · en) = 파랑 v4 · 견본 글 0 · 실물 묶음이 없으면 서재 구간 자체가 없다.
test('built home (ko · en) is v4, carries no sample text, and folds the library section without real cards', (t) => {
  const app = join(root, '.next', 'server', 'app');
  const pages = [join(app, 'ko.html'), join(app, 'en.html')].filter((f) => existsSync(f));
  if (pages.length === 0) {
    t.skip('no build output (run npm run build)');
    return;
  }
  const real = existsSync(join(statory, REAL_FILE));
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    assert.ok(html.includes('blue-preview'), `${f}: v4 marker`);
    for (const s of ['견본', 'Sample data', 'Sample card', '(합성)', 'synthetic', 'evidence_export']) {
      assert.ok(!html.includes(s), `${f}: ${s}`);
    }
    // 구간 글은 본 글(messages)에 있어 스크립트 짐에는 실린다 — 화면에 보이는 글만 본다(en 관문과 같은 잣대)
    const shown = visibleTexts(html);
    if (!real) {
      for (const s of ['연구는 무엇을 말하나 · Statory', 'What the research says · Statory', '아직 카드 없음', 'No cards yet']) {
        assert.ok(!shown.some((x) => x.includes(s)), `${f}: section should be folded — ${s}`);
      }
    } else {
      // R22 판 2 재실행: 실물이 들어오면 구간이 보인다
      assert.ok(
        shown.some((x) => x.includes('연구는 무엇을 말하나') || x.includes('What the research says')),
        `${f}: library section should be shown with real cards`,
      );
    }
  }
});

test('contract v1.1: empty country = unknown (not Korea), optional types, cc_by_sa, contract field', () => {
  const parsed = parseExport({
    version: 'evidence_export_v1',
    contract: '1.1',
    exported_at: '2026-11-03T00:00:00Z',
    cards: [
      { card_id: 'a', type: '도박', types: ['도박', '게임', '커피'], title: 'x', year: 2022, country: '', approved_at: '2026-11-01', license: 'cc_by_sa', findings_ko: '첫 문장이다. 둘째 문장이다. 셋째 문장이다.' },
      { card_id: 'b', type: '도박', title: 'y', year: 2020, country: 'KR', approved_at: '2026-10-01', license: 'cc_by', source_grade: 'unknown' },
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.data.contract, '1.1');
  assert.equal(parsed.dropped, 0);
  const [a, b] = parsed.data.cards;
  assert.equal(a.country, '');
  assert.deepEqual(a.types, ['도박', '게임']);
  assert.equal(a.license, 'cc_by_sa');
  assert.deepEqual(b.types, []);
  assert.equal(b.source_grade, null); // 「unknown」 = 빈 칸
  const tiles = typeTiles(parsed.data, { includeEmpty: true });
  assert.equal(tiles.length, 6);
  const g = tiles.find((x) => x.type === 'gambling');
  assert.deepEqual([g?.n, g?.korea], [2, 1]);
  assert.equal(tiles.find((x) => x.type === 'drug')?.n, 0);
  assert.deepEqual(typesWithCards(parsed.data), ['gambling']);
  assert.equal(shortQuote('첫 문장이다. 둘째 문장이다. 셋째 문장이다.'), '첫 문장이다. 둘째 문장이다.');
  assert.equal(shortQuote('한 문장뿐.'), '한 문장뿐.');
  // v1(contract 칸 없음)도 읽는다 — contract null
  assert.equal(parseExport({ version: 'evidence_export_v1', exported_at: 'x', cards: [] })?.data.contract, null);
});

// R22 판 2 재실행 ■1: 저장소에 든 실물 묶음 = 계약 1.1 · 카드 전부 통과 · 식별값 꼴 0 · 면허 밖 원문 0.
test('real Statory export (if present): v1.1, every card parses, no identifier patterns, no source text outside cc_by/cc_by_sa', (t) => {
  const f = join(statory, REAL_FILE);
  if (!existsSync(f)) {
    t.skip('no real export');
    return;
  }
  const raw = JSON.parse(readFileSync(f, 'utf8')) as { cards: Record<string, unknown>[] };
  const parsed = parseExport(raw);
  assert.ok(parsed);
  assert.equal(parsed.data.contract, '1.1');
  assert.equal(parsed.dropped, 0);
  assert.equal(parsed.data.cards.length, raw.cards.length);
  const pats = [
    /(?<!\d)\d{6}\s?-\s?[1-4]\d{6}(?!\d)/, // 주민번호
    /(?<![\d./])01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}(?![\d./])/, // 휴대전화
    /(?<![\d./])0\d{1,2}-\d{3,4}-\d{4}(?![\d./])/, // 전화
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // 이메일
  ];
  for (const c of raw.cards) {
    for (const [k, v] of Object.entries(c)) {
      const s = typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : '';
      for (const re of pats) assert.ok(!re.test(s), `${String(c.card_id)}.${k}: identifier pattern`);
    }
  }
  for (const c of parsed.data.cards) {
    if (c.license !== 'cc_by' && c.license !== 'cc_by_sa') {
      assert.equal(c.findings_src, null, `${c.card_id}: source text under ${c.license}`);
    }
  }
});
