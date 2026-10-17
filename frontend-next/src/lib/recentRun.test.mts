// SOC-R7 ■1 — 홈 재굽기 문지기: 밤 회차 또는 자정 재굽기가 한 시간 안. 실행: npm test (node --test · 설치 0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentRun } from './recentRun.ts';

const at = (s: string) => Date.parse(`2026-10-18T${s}+09:00`);

test('opens for a nightly run (04:00) or a midnight refresh (00:05) started within the hour', () => {
  const nightly = { lastRun: { startedAt: '2026-10-17T19:00:00.013Z' }, lastRefresh: null };
  assert.equal(recentRun(nightly, at('04:01:23')), true);

  // 00:05 — lastRun 은 어제 04:00(20시간 전), lastRefresh 가 방금 시작
  const midnight = {
    lastRun: { startedAt: '2026-10-16T19:00:00.013Z' },
    lastRefresh: { startedAt: '2026-10-17T15:05:00.010Z' },
  };
  assert.equal(recentRun(midnight, at('00:05:02')), true);
});

test('stays shut (409) when neither started within the hour, or the record is missing', () => {
  const old = {
    lastRun: { startedAt: '2026-10-16T19:00:00.013Z' },
    lastRefresh: { startedAt: '2026-10-17T15:05:00.010Z' },
  };
  assert.equal(recentRun(old, at('01:05:01')), false);
  assert.equal(recentRun(old, at('13:00:00')), false);
  assert.equal(recentRun({ lastRun: null, lastRefresh: null }, at('04:01:00')), false);
  assert.equal(recentRun({ lastRun: { startedAt: 'nope' } }, at('04:01:00')), false);
  assert.equal(recentRun(null, at('04:01:00')), false);
});
