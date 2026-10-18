// SOC-R8 ■4 — 영어 화면의 단위·출처 이름. 실행: npm test (node --test · 설치 0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORG_EN, UNIT_EN, orgLabel, unitLabel } from './enLabels.ts';

const HANGUL = /[가-힣]/;

test('every Hangul unit used by the 11 indicators reads in English on /en, ko unchanged', () => {
  // 10-18 운영 /api/indicators 11개의 unit
  const units = ['L', '명', '%', '%', '백만 명', '%', '%', '%', '%', '%', '%'];
  for (const u of units) {
    assert.equal(unitLabel(u, 'ko'), u);
    assert.doesNotMatch(unitLabel(u, 'en'), HANGUL);
  }
  assert.equal(unitLabel('명', 'en'), 'persons');
  assert.equal(unitLabel('백만 명', 'en'), 'million people');
  assert.equal(unitLabel('%', 'en'), '%');
  assert.equal(unitLabel(null, 'en'), '');
  for (const v of Object.values(UNIT_EN)) assert.doesNotMatch(v, HANGUL);
});

test('every source whose seed org is Hangul has an English name; others keep their org', () => {
  const seed = readFileSync(
    new URL('../../../backend/src/sources/seed/sources.seed.ts', import.meta.url),
    'utf8',
  );
  const rows = [...seed.matchAll(/id: '([a-z0-9_]+)',\s*\n\s*org: '([^']+)'/g)].map(
    (m) => ({ id: m[1], org: m[2] }),
  );
  assert.ok(rows.length >= 24, `seed rows ${rows.length}`);
  const hangul = rows.filter((r) => HANGUL.test(r.org)).map((r) => r.id).sort();
  assert.deepEqual(hangul, Object.keys(ORG_EN).sort());
  for (const r of rows) {
    assert.doesNotMatch(orgLabel(r, 'en'), HANGUL, r.id);
  }
  for (const v of Object.values(ORG_EN)) assert.doesNotMatch(v, HANGUL);

  // 10-17 en 홈 실측: 「Source 대검찰청」 → 영어
  const spo = { id: 'spo_drug_monthly', org: '대검찰청', orgKo: '대검찰청' };
  assert.equal(orgLabel(spo, 'en'), "Supreme Prosecutors' Office");
  assert.equal(orgLabel(spo, 'ko'), '대검찰청');
  assert.equal(orgLabel({ id: 'unodc_wdr', org: 'UNODC', orgKo: '유엔마약범죄사무소' }, 'en'), 'UNODC');
  assert.equal(orgLabel({ id: 'unodc_wdr', org: 'UNODC', orgKo: '유엔마약범죄사무소' }, 'ko'), '유엔마약범죄사무소');
  // 표에 없는 id 는 지어내지 않고 원래 값
  assert.equal(orgLabel({ id: 'new_one', org: '새기관', orgKo: '새기관' }, 'en'), '새기관');
});
