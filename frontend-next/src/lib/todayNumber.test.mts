// SOC-R5 ■4 — 「오늘의 숫자」 날마다 순환. 실행: npm test (node --test · 설치 0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, kstDate, pickTodaysNumber } from './todayNumber.ts';

// 10-15 운영 지표 7 + 점 하나뿐인 지표 1(후보 아님)
const prod = [
  { code: 'spo_drug_offenders_total', points: 11 },
  { code: 'knhanes_current_smoking_rate', points: 10 },
  { code: 'knhanes_high_risk_drinking_rate', points: 10 },
  { code: 'kcgp_youth_gambling_problem_rate', points: 4 },
  { code: 'kcgp_youth_gambling_atrisk_rate', points: 4 },
  { code: 'kcgp_youth_gambling_problem_group_rate', points: 4 },
  { code: 'kcgp_youth_v2', points: 2 },
  { code: 'one_point_only', points: 1 },
];

test('same KST day = same number; the next KST day = the next one; all candidates in turn', () => {
  // 10-15 00:05 KST 와 23:55 KST 는 같은 날
  const morning = new Date('2026-10-14T15:05:00Z');
  const night = new Date('2026-10-15T14:55:00Z');
  assert.equal(kstDate(morning), '2026-10-15');
  assert.equal(kstDate(night), '2026-10-15');
  assert.equal(dayNumber('2026-10-15'), 20741);
  const a = pickTodaysNumber(prod, morning);
  const b = pickTodaysNumber(prod, night);
  assert.ok(a && b);
  assert.equal(a.pick.code, b.pick.code);
  assert.equal(a.total, 7); // 점 하나뿐인 지표는 빠진다
  assert.equal(a.index, 20741 % 7);

  // UTC 자정이 아니라 KST 자정에 바뀐다: 10-15 15:00Z = 10-16 00:00 KST
  const next = pickTodaysNumber(prod, new Date('2026-10-15T15:00:00Z'));
  assert.ok(next);
  assert.equal(next.index, (a.index + 1) % 7);

  // 7일이면 후보 7 이 한 번씩
  const seen = new Set<string>();
  for (let d = 0; d < 7; d++) {
    const p = pickTodaysNumber(prod, new Date(Date.UTC(2026, 9, 15 + d, 3)));
    seen.add(p!.pick.code);
  }
  assert.equal(seen.size, 7);
});

test('order is by code, not by input order or point count; no candidate → null', () => {
  const shuffled = [...prod].reverse();
  const when = new Date('2026-10-15T03:00:00Z');
  assert.deepEqual(pickTodaysNumber(shuffled, when), pickTodaysNumber(prod, when));
  // code 순 7 개 중 20741 % 7 = 0 번째 → 'kcgp_youth_gambling_atrisk_rate'
  assert.equal(pickTodaysNumber(prod, when)!.pick.code, 'kcgp_youth_gambling_atrisk_rate');
  assert.equal(pickTodaysNumber([{ code: 'x', points: 1 }], when), null);
  assert.equal(pickTodaysNumber([], when), null);
});
