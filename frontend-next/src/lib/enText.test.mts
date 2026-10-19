// SOC-R9 ■1 — 영어 화면의 지표 정의·단서 · 정책 문서 · 회복 기관 · 연구실. 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  COUNTRY_EN,
  GROUP_EN,
  LAB_SUMMARY_EN,
  LAW_TITLE_EN,
  cityLabel,
  countryLabel,
  definitionLabel,
  documentTitleLabel,
  groupLabel,
  methodNoteLabel,
  observationNoteLabel,
  recoveryAddressLabel,
  recoveryDescLabel,
  recoveryNameLabel,
  reportTitleLabel,
} from './enLabels.ts';
import {
  DEFINITION_EN,
  METHOD_NOTE_EN,
  OBSERVATION_NOTE_EN,
} from './enIndicators.ts';
import { romanizeAddress, romanizeWord } from './romanize.ts';

const HANGUL = /[가-힣ㄱ-ㆎ]/;
const backend = (p: string) =>
  new URL(`../../../backend/src/${p}`, import.meta.url);

type Obs = { period: string; note?: string; page?: string | number; table?: string };
type Ind = {
  code: string;
  definitionKo: string;
  methodNote: string | null;
  observationNote?: string;
  observations: Obs[];
};

function seedIndicators(): Ind[] {
  const dir = backend('indicators/seed/');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.data.json'))
    .flatMap(
      (f) =>
        (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { indicators: Ind[] })
          .indicators,
    );
}

test('all 11 indicators have English definition and reading note; ko unchanged', () => {
  const inds = seedIndicators();
  assert.equal(inds.length, 11);
  assert.deepEqual(
    inds.map((i) => i.code).sort(),
    Object.keys(DEFINITION_EN).sort(),
  );
  assert.deepEqual(
    inds.filter((i) => i.methodNote).map((i) => i.code).sort(),
    Object.keys(METHOD_NOTE_EN).sort(),
  );
  for (const i of inds) {
    assert.doesNotMatch(definitionLabel(i, 'en'), HANGUL, i.code);
    assert.ok(definitionLabel(i, 'en').length > 40, i.code);
    assert.doesNotMatch(methodNoteLabel(i, 'en'), HANGUL, i.code);
    assert.equal(definitionLabel(i, 'ko'), i.definitionKo);
    assert.equal(methodNoteLabel(i, 'ko'), i.methodNote ?? '');
  }
  // 10-19 /en/indicators 실측 첫 줄
  assert.match(
    definitionLabel({ code: 'who_alcohol_per_capita_kr', definitionKo: '15세 이상 …' }, 'en'),
    /^Litres of pure alcohol/,
  );
  // 표에 없는 지표: 한국어를 내보내지 않음
  assert.equal(definitionLabel({ code: 'new_one', definitionKo: '새 정의' }, 'en'), '');
  assert.equal(definitionLabel({ code: 'new_one', definitionKo: 'Plain English' }, 'en'), 'Plain English');
});

test('every observation note the seed writes has an English note (98 observations)', () => {
  const inds = seedIndicators();
  let total = 0;
  let noted = 0;
  for (const i of inds) {
    const want: string[] = [];
    for (const o of i.observations) {
      total++;
      // indicator-seed.ts resolveObservation 과 같은 조건: note ?? observationNote · page · table
      const hasNote = !!(o.note ?? i.observationNote) || o.page != null || !!o.table;
      if (!hasNote) continue;
      noted++;
      want.push(o.period);
      const en = observationNoteLabel(i.code, { period: o.period, note: 'x' }, 'en');
      assert.ok(en, `${i.code} ${o.period}`);
      assert.doesNotMatch(en, HANGUL, `${i.code} ${o.period}`);
    }
    // 표에 남는 기간(지어낸 관측치) 0
    assert.deepEqual(
      Object.keys(OBSERVATION_NOTE_EN[i.code] ?? {}).sort(),
      want.sort(),
      i.code,
    );
  }
  assert.ok(total >= 98, `observations ${total}`);
  assert.equal(noted, total - 3); // kcgp 2022 세 줄은 단서 없음
  // 단서 없는 관측치는 en 도 빈칸 · ko 는 원문 그대로
  assert.equal(observationNoteLabel('kcgp_youth_v2', { period: '2024', note: null }, 'en'), '');
  assert.equal(observationNoteLabel('x', { period: '2024', note: '원문' }, 'ko'), '원문');
  assert.equal(observationNoteLabel('x', { period: '2024', note: '원문' }, 'en'), '');
  assert.match(
    observationNoteLabel('spo_drug_offenders_total', { period: '2025', note: '…' }, 'en'),
    /23,403/,
  );
});

test('policy documents read in English: country, source titles, laws', () => {
  const seed = readFileSync(backend('policy/seed/documents.seed.ts'), 'utf8');
  const scope = seed.match(/SCOPE_COUNTRY[^{]*\{([\s\S]*?)\}/)![1];
  const countries = [...scope.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(countries.sort(), Object.keys(COUNTRY_EN).sort());
  for (const c of countries) assert.doesNotMatch(countryLabel(c, 'en'), HANGUL);
  assert.equal(countryLabel('대한민국', 'ko'), '대한민국');

  const laws = (
    JSON.parse(readFileSync(backend('policy/seed/documents.data.json'), 'utf8')) as {
      laws: { title: string }[];
    }
  ).laws.map((l) => l.title);
  assert.deepEqual(laws.sort(), Object.keys(LAW_TITLE_EN).sort());
  for (const t of laws) {
    assert.doesNotMatch(documentTitleLabel({ title: t, summary: '소관 …' }, 'en'), HANGUL);
  }
  // 출처 대표 문서: summary = 출처 영어 제목
  const doc = {
    title: '마약류 월간동향',
    summary: 'Monthly Narcotics Trend Report',
    sourceId: 'spo_drug_monthly',
  };
  assert.equal(documentTitleLabel(doc, 'en'), 'Monthly Narcotics Trend Report');
  assert.equal(documentTitleLabel(doc, 'ko'), '마약류 월간동향');
  assert.equal(documentTitleLabel({ title: '새 문서', summary: '요약' }, 'en'), '');
});

test('all 73 recovery centers: name, address, city and description have no Hangul on /en', () => {
  const rows = (
    JSON.parse(readFileSync(backend('recovery/seed/recovery-directory.data.json'), 'utf8')) as {
      resources: { name: string; address: string; city: string; description: string }[];
    }
  ).resources;
  assert.equal(rows.length, 73);
  for (const r of rows) {
    for (const v of [
      recoveryNameLabel(r.name, 'en'),
      recoveryAddressLabel(r.address, 'en'),
      cityLabel(r.city, 'en'),
      recoveryDescLabel(r.description, 'en'),
    ]) {
      assert.ok(v, r.name);
      assert.doesNotMatch(v, HANGUL, `${r.name}: ${v}`);
    }
    assert.equal(recoveryNameLabel(r.name, 'ko'), r.name);
    assert.equal(recoveryAddressLabel(r.address, 'ko'), r.address);
  }
  assert.equal(
    recoveryNameLabel('강남구중독관리통합지원센터', 'en'),
    'Gangnam-gu Addiction Management Center',
  );
  assert.equal(
    recoveryNameLabel('광주광산구중독관리통합지원센터', 'en'),
    'Gwangju Gwangsan-gu Addiction Management Center',
  );
  assert.equal(
    recoveryNameLabel('강원광역중독관리통합지원센터', 'en'),
    'Gangwon Metropolitan Addiction Management Center',
  );
  assert.equal(recoveryNameLabel('경기남부스마트쉼센터', 'en'), 'Gyeonggi South Smart Shim Center');
  assert.equal(
    recoveryAddressLabel('서울특별시 강북구 삼양로19길 154, 2층', 'en'),
    'Seoul Gangbuk-gu Samyang-ro 19-gil 154, 2F',
  );
  assert.equal(
    recoveryAddressLabel('강남구 선릉로 668 강남구보건소 5층', 'en'),
    'Gangnam-gu Seolleung-ro 668 Gangnam-gu Public Health Center 5F',
  );
  assert.equal(
    romanizeAddress('서울특별시 중구 청계천로 14(무교동 77) 한국지능정보사회진흥원 지하1층'),
    'Seoul Jung-gu Cheonggyecheon-ro 14 (Mugyo-dong 77) National Information Society Agency B1F',
  );
  assert.equal(cityLabel('경기북부', 'en'), 'Gyeonggi North');
});

test('romanization follows the 2000 Revised Romanization sound rules', () => {
  const cases: [string, string][] = [
    ['선릉', 'seolleung'], // ㄴ+ㄹ → ll
    ['종로', 'jongno'], // ㅇ+ㄹ → n
    ['왕십리', 'wangsimni'], // ㅂ+ㄹ → m n
    ['독립', 'dongnip'], // ㄱ+ㄹ → ng n
    ['신라', 'silla'],
    ['백마', 'baengma'], // ㄱ+ㅁ → ng
    ['천안', 'cheonan'], // 연음
    ['옥천', 'okcheon'],
    ['의정부', 'uijeongbu'],
    ['울산', 'ulsan'],
  ];
  for (const [ko, ro] of cases) assert.equal(romanizeWord(ko), ro, ko);
});

test('lab summaries are English', () => {
  for (const v of Object.values(LAB_SUMMARY_EN)) assert.doesNotMatch(v, HANGUL);
});

test('review fixes: breakdown group names and lab titles never show Korean on /en', () => {
  // observation.entity 주석의 예 · PDF 추출 분해 집단
  assert.equal(groupLabel('남학생', 'en'), 'Boys');
  assert.equal(groupLabel('중학교', 'en'), 'Middle school');
  assert.equal(groupLabel('처음 보는 집단', 'en'), 'Subgroup');
  assert.equal(groupLabel('15-24', 'en'), '15-24');
  assert.equal(groupLabel('남학생', 'ko'), '남학생');
  for (const v of Object.values(GROUP_EN)) assert.doesNotMatch(v, HANGUL);

  assert.equal(reportTitleLabel({ title_ko: '중독이란?', title_en: 'What Is Addiction?' }, 'en'), 'What Is Addiction?');
  assert.equal(reportTitleLabel({ title_ko: '새 보고서', title_en: null }, 'en'), 'Lab report');
  assert.equal(reportTitleLabel({ title_ko: '새 보고서', title_en: null }, 'ko'), '새 보고서');
});
