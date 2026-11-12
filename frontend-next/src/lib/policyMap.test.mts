// SOC-R24 — 정책 쪽: 칸 문턱 · 쪽 열림 · 출처 줄 · 사실 문장 규칙 · en 한글 0. 모델 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pageOpens,
  sectionTally,
  standingSections,
  stands,
  timelineAreaCounts,
  usedSourceIds,
  hasSource,
} from './policyMap.ts';
import {
  COUNTRIES,
  FIGURES,
  GAPS,
  LAYERS,
  LOCAL,
  MINISTRIES,
  MORE_FIGURES,
  REFERENCE,
  RESEARCH,
  SOURCES,
  TIMELINE,
} from '../data/policy-map.ts';

test('threshold: half or more of the claimed items must be verified; page opens at 4 of 7', () => {
  assert.equal(stands(1, 2), true);
  assert.equal(stands(2, 5), false);
  assert.equal(stands(3, 5), true);
  assert.equal(stands(0, 0), false);
  assert.equal(pageOpens(['size', 'who', 'changes']), false);
  assert.equal(pageOpens(['size', 'who', 'changes', 'gaps']), true);
  const t = sectionTally();
  for (const [k, v] of Object.entries(t)) assert.ok(v.shown <= v.claimed + 0, `${k}: shown ${v.shown} ≤ claimed ${v.claimed}`);
});

test('the current data: which sections stand', () => {
  const s = standingSections();
  assert.deepEqual(s, ['size', 'who', 'changes', 'gaps', 'abroad', 'research', 'local']);
  assert.ok(pageOpens(s));
});

test('every shown value has at least one source; every source id exists and links out over https', () => {
  const shown = [
    ...FIGURES,
    ...MORE_FIGURES,
    ...LAYERS.flatMap((r) => Object.values(r.cells).filter((c) => c !== null)),
    ...TIMELINE,
    ...GAPS.filter((g) => g.value !== null),
    ...COUNTRIES,
    ...RESEARCH,
    ...LOCAL.filter((g) => g.value !== null),
  ];
  for (const x of shown) assert.ok(x!.src.length > 0, JSON.stringify(x).slice(0, 80));
  for (const id of usedSourceIds()) assert.ok(hasSource(id), id);
  for (const [id, s] of Object.entries(SOURCES)) assert.match(s.url, /^https:\/\//, id);
  // 비어 있다고 적는 칸은 출처를 달지 않는다(지어내기 0)
  for (const g of [...GAPS, ...LOCAL].filter((g) => g.value === null)) assert.equal(g.src.length, 0);
});

const allText = () =>
  JSON.stringify([FIGURES, MORE_FIGURES, LAYERS, MINISTRIES, TIMELINE, GAPS, COUNTRIES, RESEARCH, LOCAL, REFERENCE, SOURCES]);

test('fact sentences only: no should/must recommendations; drink-driving is not called addiction', () => {
  const s = allText();
  assert.ok(!/해야\s*한다|해야 함|하여야\s*한다|필요하다|바람직|should|ought to|must be|we recommend/i.test(s));
  assert.ok(!/음주운전[^"]{0,20}중독|drunk[- ]driving[^"]{0,20}addict/i.test(s));
});

test('English side has no Hangul (en page gate)', () => {
  const en: string[] = [];
  const walk = (o: unknown) => {
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (k === 'en' && typeof v === 'string') en.push(v);
        else walk(v);
      }
    }
  };
  walk([FIGURES, MORE_FIGURES, LAYERS, MINISTRIES, TIMELINE, GAPS, COUNTRIES, RESEARCH, LOCAL, REFERENCE, SOURCES]);
  assert.ok(en.length > 100);
  for (const s of en) assert.ok(!/[가-힣ㄱ-ㆎ]/.test(s), s);
});

test('timeline: area counts and dates from 2022 on, in order', () => {
  const c = timelineAreaCounts();
  assert.equal(c.reduce((a, b) => a + b.n, 0), TIMELINE.length);
  assert.deepEqual(c[0], { area: 'drugs', n: 5 });
  const ds = TIMELINE.map((t) => t.date.split('.').map(Number));
  for (const [y] of ds) assert.ok(y >= 2022);
  for (let i = 1; i < ds.length; i++) {
    const [a, am = 0] = ds[i - 1];
    const [b, bm = 0] = ds[i];
    assert.ok(a < b || (a === b && am <= bm), TIMELINE[i].date);
  }
  assert.deepEqual(timelineAreaCounts([{ area: 'alcohol' }, { area: 'gambling' }, { area: 'gambling' }]), [
    { area: 'gambling', n: 2 },
    { area: 'alcohol', n: 1 },
  ]);
});

test('four headline figures, one per area', () => {
  assert.deepEqual(FIGURES.map((f) => f.area), ['alcohol', 'drugs', 'gambling', 'digital']);
});
