// SOC-R23 ■2 — 근거 쪽 나눔(한 쪽 40장 · 100장 넘는 유형만) · 하위 주제 낱말 규칙 · 주소 꼴. 모델 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAGE_SIZE,
  SPLIT_OVER,
  allRests,
  hrefOf,
  parseRest,
  restOf,
  sliceView,
  subtopicsOf,
  topicCounts,
} from './evidencePages.ts';
import { TILE_TYPES, cardsOfType, loadStatoryExport, type EvidenceCard } from './statoryEvidence.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

const card = (i: number, o: Partial<EvidenceCard> = {}): EvidenceCard => ({
  card_id: `c${String(i).padStart(4, '0')}`,
  type: '알코올',
  types: [],
  title: `Card ${i}`,
  authors_short: 'Kim et al.',
  year: 2020,
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
  approved_at: '2026-11-01',
  ...o,
});

test('address tail: parse ↔ build round trip; malformed tails are null (404)', () => {
  for (const v of [
    { topic: null, page: 1 },
    { topic: null, page: 3 },
    { topic: 'youth', page: 1 },
    { topic: 'policy', page: 2 },
  ] as const) {
    assert.deepEqual(parseRest(restOf(v)), v);
  }
  assert.deepEqual(parseRest(undefined), { topic: null, page: 1 });
  for (const bad of [
    ['page', '1'],
    ['page', '0'],
    ['page', '02'],
    ['page', 'x'],
    ['topic'],
    ['topic', 'sports'],
    ['page', '2', 'topic', 'youth'],
    ['topic', 'youth', 'extra'],
    ['x'],
  ]) {
    assert.equal(parseRest(bad), null, bad.join('/'));
  }
  assert.equal(hrefOf('alcohol', { topic: null, page: 1 }), '/evidence/alcohol');
  assert.equal(hrefOf('alcohol', { topic: 'youth', page: 2 }), '/evidence/alcohol/topic/youth/page/2');
});

test('subtopic word rules: title + library summary; none → other; 방법 is not policy', () => {
  assert.deepEqual(subtopicsOf({ title: '청소년 음주 예방 프로그램', findings_ko: null }), ['prevention', 'youth']);
  assert.deepEqual(subtopicsOf({ title: 'Naltrexone for AUD', findings_ko: null }), ['treatment']);
  assert.deepEqual(subtopicsOf({ title: 'Minimum unit pricing in Scotland', findings_ko: null }), ['policy']);
  assert.deepEqual(subtopicsOf({ title: '통합사례관리 접근법 효과', findings_ko: '연구 방법은 면접이다.' }), ['other']);
  assert.deepEqual(subtopicsOf({ title: 'Liver disease', findings_ko: '주세 인상 뒤 음주가 줄었다.' }), ['policy']);
});

test('≤ 100 cards: one page, no filter; > 100: 40 per page, page past the end is null', () => {
  const small = Array.from({ length: SPLIT_OVER }, (_, i) => card(i));
  assert.equal(sliceView(small, { topic: null, page: 1 })?.cards.length, SPLIT_OVER);
  assert.equal(sliceView(small, { topic: null, page: 2 }), null);
  assert.equal(sliceView(small, { topic: 'youth', page: 1 }), null);
  assert.deepEqual(allRests(small), [[]]);

  const big = Array.from({ length: 130 }, (_, i) =>
    card(i, { title: i % 2 ? `Youth study ${i}` : `Adult study ${i}` }),
  );
  const p1 = sliceView(big, { topic: null, page: 1 })!;
  assert.deepEqual([p1.cards.length, p1.pages, p1.from, p1.to], [PAGE_SIZE, 4, 1, 40]);
  const p4 = sliceView(big, { topic: null, page: 4 })!;
  assert.deepEqual([p4.cards.length, p4.from, p4.to], [10, 121, 130]);
  assert.equal(sliceView(big, { topic: null, page: 5 }), null);
  const y = sliceView(big, { topic: 'youth', page: 2 })!;
  assert.deepEqual([y.total, y.pages, y.cards.length], [65, 2, 25]);
  // 정적 주소 = 전체 4 + 청소년 2 + 그 밖 2(카드 0 인 주제는 없음)
  assert.equal(allRests(big).length, 8);
  assert.ok(!allRests(big).some((r) => r.includes('prevention')));
});

// 실물 묶음으로 — 어느 쪽도 40장을 넘지 않고, 전체 쪽들을 이으면 그 유형 카드 전부(빠짐 · 겹침 0)
test('real export: every split page ≤ 40 cards and the "all" pages cover each card exactly once', (t) => {
  if (!existsSync(join(root, 'data', 'statory', 'evidence_export_v1.json'))) {
    t.skip('no real export');
    return;
  }
  const loaded = loadStatoryExport();
  assert.ok(loaded);
  for (const type of TILE_TYPES) {
    const cards = cardsOfType(loaded.data, type);
    const rests = allRests(cards);
    const seen: string[] = [];
    for (const r of rests) {
      const v = parseRest(r);
      assert.ok(v, r.join('/'));
      const s = sliceView(cards, v);
      assert.ok(s, `${type}/${r.join('/')}`);
      assert.ok(s.cards.length > 0);
      if (cards.length > SPLIT_OVER) assert.ok(s.cards.length <= PAGE_SIZE);
      if (!v.topic) seen.push(...s.cards.map((c) => c.card_id));
    }
    assert.deepEqual(seen, cards.map((c) => c.card_id), type);
    // 주제 수 합 ≥ 카드 수(겹침 허용) · 「그 밖」 은 다른 주제와 겹치지 않음
    const counts = topicCounts(cards);
    assert.ok(counts.reduce((a, x) => a + x.n, 0) >= cards.length);
    for (const c of cards) {
      const s = subtopicsOf(c);
      assert.ok(!(s.includes('other') && s.length > 1));
    }
  }
});
