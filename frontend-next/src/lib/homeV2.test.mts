// SOC-R19 ■1 · ■2 · ■4 — 홈 v2 규칙(변화 · 지수 · 셋 고르기 · 유형 · 논문 한 줄). 모델 0 · 저장 값 그대로.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeFromPrevious, indexSeries, threeFrom, yearDomain } from './homeV2.ts';
import {
  ADDICTION_TYPES,
  TYPE_REPRESENTATIVE,
  indicatorType,
  sourceType,
  titleType,
} from './addictionTypes.ts';
import { paperLine } from './paperLine.ts';

const S = (pairs: Array<[string, string]>) =>
  pairs.map(([period, value]) => ({ period, value }));

test('change vs previous survey: decimals of the stored values, no float tail', () => {
  const c = changeFromPrevious(S([['2023', '13.8'], ['2024', '13.6']]), null);
  assert.deepEqual(c, { kind: 'delta', text: '−0.2', sign: -1, fromPeriod: '2023' });
  const up = changeFromPrevious(S([['2024', '23022'], ['2025', '23403']]), null);
  assert.deepEqual(up, { kind: 'delta', text: '+381', sign: 1, fromPeriod: '2024' });
  const same = changeFromPrevious(S([['2022', '8.3'], ['2023', '8.30']]), null);
  assert.equal(same.kind === 'delta' && same.text, '0.00');
});

test('change across a survey-design break is not compared', () => {
  // kocca_game_usage_rate: break 2023 · last pair 2024→2025 has no break → compared
  const game = S([['2022', '74.4'], ['2023', '62.9'], ['2024', '62.8'], ['2025', '52.7']]);
  assert.equal(changeFromPrevious(game, [2023]).kind, 'delta');
  // kcgp: 2020 → 2022 crosses the 2022 break
  const g = S([['2015', '5.1'], ['2018', '6.4'], ['2020', '2.4'], ['2022', '4.8']]);
  assert.deepEqual(changeFromPrevious(g, [2020, 2022]), { kind: 'break', fromPeriod: '2020' });
  assert.deepEqual(changeFromPrevious(S([['2025', '1']]), null), { kind: 'none' });
});

test('index view: first value = 100, display only; zero base gives null', () => {
  assert.deepEqual(indexSeries(S([['2015', '50'], ['2016', '75']])), [100, 150]);
  assert.equal(indexSeries(S([['2015', '0'], ['2016', '1']])), null);
  assert.equal(indexSeries([]), null);
});

test('three tiles start at today\'s number and wrap', () => {
  assert.deepEqual(threeFrom(['a', 'b', 'c', 'd'], 3), ['d', 'a', 'b']);
  assert.deepEqual(threeFrom(['a', 'b'], 1), ['b', 'a']);
  assert.deepEqual(threeFrom([], 0), []);
  assert.deepEqual(yearDomain([S([['2015', '1']]), S([['2025', '2']])]), [2015, 2025]);
});

test('six types, each with one representative indicator', () => {
  assert.equal(ADDICTION_TYPES.length, 6);
  for (const t of ADDICTION_TYPES) assert.equal(indicatorType(TYPE_REPRESENTATIVE[t]), t);
  assert.equal(indicatorType('who_alcohol_per_capita_kr'), 'alcohol');
  assert.equal(indicatorType('unodc_global_drug_users'), 'drug');
  assert.equal(sourceType({ id: 'kocca_game', domain: 'digital' }), 'game');
  assert.equal(sourceType({ id: 'nia_smartphone', domain: 'digital' }), 'smartphone');
  assert.equal(sourceType({ id: 'x', domain: 'policy' }), null);
});

test('title words pick a type only when exactly one type matches', () => {
  assert.equal(titleType('진짜 심각하다는 대한민국 마약 근황'), 'drug');
  assert.equal(titleType('책임지는 부처가 없는 도박 공화국의 모순'), 'gambling');
  assert.equal(titleType('솔직히 전자 담배는 괜찮을 줄 알았다'), 'tobacco');
  assert.equal(titleType('스마트폰 또는 게임'), null);
  assert.equal(titleType('기술과 사회'), null);
  assert.equal(titleType(null), null);
});

test('paper line = topic · instrument · sample words only, no sentence', () => {
  const a = paperLine('Impulsivity predicts problem gambling in low SES adolescent males.');
  assert.deepEqual(a, {
    topics: ['도박', '충동성'],
    instruments: [],
    samples: ['청소년', '남성', '저소득층'],
  });
  const b = paperLine('Validity of the SOGS-RA and PGSI in youth', ['SOGS', 'PGSI', 'SOGS-RA']);
  assert.deepEqual(b?.instruments, ['PGSI', 'SOGS-RA']);
  assert.equal(paperLine('On the nature of things'), null);
});
