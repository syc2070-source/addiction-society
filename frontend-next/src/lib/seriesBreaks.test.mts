// SOC-R6 ■2 — 조사 설계 변경 해에서 추세선 끊기. 실행: npm test (node --test · 설치 0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodYear, seriesBreakYears, splitAtBreaks } from './seriesBreaks.ts';

test('KOCCA 2016–2025 breaks before 2023; kcgp 2015/2018/2020/2022 breaks at 2020 and 2022', () => {
  const kocca = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
  assert.deepEqual(splitAtBreaks(kocca, [2023]), [
    [0, 1, 2, 3, 4, 5, 6],
    [7, 8, 9],
  ]);
  assert.deepEqual(seriesBreakYears(kocca, [2023]), [2023]);

  const kcgp = ['2015', '2018', '2020', '2022'];
  assert.deepEqual(splitAtBreaks(kcgp, [2020, 2022]), [[0, 1], [2], [3]]);
  assert.deepEqual(seriesBreakYears(kcgp, [2022, 2020]), [2020, 2022]);

  // 끊는 해가 점 사이 빈 해여도 그 뒤 첫 점에서 끊는다(2019 조사 없음 → 2020 에서)
  assert.deepEqual(splitAtBreaks(['2018', '2020'], [2019]), [[0], [1]]);
  assert.equal(periodYear('2023-06'), 2023);
});

test('no break years, or years outside the series, leave one unbroken line and no tail', () => {
  const s = ['2016', '2017', '2018'];
  assert.deepEqual(splitAtBreaks(s, null), [[0, 1, 2]]);
  assert.deepEqual(splitAtBreaks(s, []), [[0, 1, 2]]);
  // 첫 점 해(2016) 자체는 비교할 앞 점이 없어 꼬리도 없음 · 범위 밖 해도 없음
  assert.deepEqual(seriesBreakYears(s, [2016, 2030, 2010]), []);
  assert.deepEqual(splitAtBreaks(s, [2016, 2030]), [[0, 1, 2]]);
  assert.deepEqual(splitAtBreaks([], [2020]), []);
});
