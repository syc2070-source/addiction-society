// SOC-R9 ■1 — 영어 화면의 지표 정의·단서 · 정책 문서 · 회복 기관 · 연구실. 실행: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  COUNTRY_EN,
  GROUP_EN,
  LAB_SUMMARY_EN,
  LAW_TITLE_EN,
  RECOVERY_KIND_EN,
  broadcastLineLabels,
  broadcastTitleLabel,
  broadcasterLabel,
  cityLabel,
  countryLabel,
  definitionLabel,
  documentTitleLabel,
  groupLabel,
  methodNoteLabel,
  observationNoteLabel,
  recoveryAddressLabel,
  recoveryDescLabel,
  recoveryKindLabel,
  recoveryNameLabel,
  reportTitleLabel,
} from './enLabels.ts';
import { BROADCAST_NAMES_EN } from './broadcastNamesEn.ts';
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

test('SOC-R10 ■2: every recovery center gets an English kind meaning (3 kinds, 57/6/10)', () => {
  const rows = (
    JSON.parse(readFileSync(backend('recovery/seed/recovery-directory.data.json'), 'utf8')) as {
      resources: { name: string; type: string }[];
    }
  ).resources;
  const byKind = new Map<string, number>();
  for (const r of rows) {
    const kind = recoveryKindLabel(r.name, 'en');
    assert.ok(kind, r.name);
    assert.doesNotMatch(kind, HANGUL, r.name);
    assert.equal(recoveryKindLabel(r.name, 'ko'), '');
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  assert.deepEqual([...byKind.values()].sort((a, b) => a - b), [6, 10, 57]);
  assert.equal(byKind.size, RECOVERY_KIND_EN.length);
  assert.deepEqual([...new Set(rows.map((r) => r.type))], ['counseling']);
  // 광역 은 일반 센터보다 먼저 맞춘다
  assert.match(recoveryKindLabel('강원광역중독관리통합지원센터', 'en'), /^Metropolitan/);
  assert.match(recoveryKindLabel('강남구중독관리통합지원센터', 'en'), /^Community/);
  assert.match(recoveryKindLabel('경기남부스마트쉼센터', 'en'), /^Smart Rest Center/);
  assert.equal(recoveryKindLabel('처음 보는 기관', 'en'), '');
});

test('SOC-R10: broadcast line on /en — first broadcast (10-21) title and broadcaster', () => {
  const title =
    '설마 하며 열었더니 "말도 안 돼.." 진짜 심각하다는 대한민국 마약 근황 | KBS 더 보다 20251207 방송';
  assert.equal(broadcastTitleLabel(title, 'en'), 'Korean-language programme');
  assert.equal(broadcastTitleLabel(title, 'ko'), title);
  assert.equal(broadcastTitleLabel('Drug Crisis in Korea', 'en'), 'Drug Crisis in Korea');
  assert.equal(broadcasterLabel('KBS 다큐인사이트', 'en'), 'KBS');
  assert.equal(broadcasterLabel('KBS 다큐인사이트', 'ko'), 'KBS 다큐인사이트');
  assert.equal(broadcasterLabel('연합뉴스TV', 'en'), '');
  assert.equal(broadcasterLabel(null, 'en'), '');
});

test('SOC-R11 · R13: broadcaster and canon programme English names — table of 9 channels, title never translated', () => {
  const keys = Object.keys(BROADCAST_NAMES_EN);
  assert.equal(keys.length, 9);
  assert.equal(new Set(keys.map((k) => BROADCAST_NAMES_EN[k].outletId)).size, 9);
  for (const k of keys) {
    const n = BROADCAST_NAMES_EN[k];
    assert.ok(!HANGUL.test(n.broadcaster) && !HANGUL.test(n.programEn), k);
    assert.equal(broadcasterLabel(k, 'en'), n.broadcaster);
    // 정본 program_en 글자 그대로(공유 채널 넷 포함 · SOC-R13 ■1)
    assert.equal(broadcastTitleLabel('한국어 제목', 'en', k), `${n.programEn} (Korean)`);
    assert.equal(broadcasterLabel(k, 'ko'), k);
  }
  // 중독뉴스 name_source(NEWS-Q13): official 은 둘뿐
  assert.deepEqual(
    keys.filter((k) => BROADCAST_NAMES_EN[k].nameSource === 'official').sort(),
    ['SBS 스페셜', '뉴스타파'],
  );
  // 10-22 04:00 회차로 들어온 방송사 다섯(운영 실측)
  const live = ['KBS 다큐인사이트', 'MBC 스트레이트', 'MBC PD수첩', 'KBS 추적60분', 'SBS 그것이 알고 싶다'];
  for (const b of live) assert.ok(BROADCAST_NAMES_EN[b], b);
  const title = '도박 청소년이 성인이 되면 | PD수첩';
  assert.equal(broadcastTitleLabel(title, 'en', 'MBC PD수첩'), 'MBC PD Notebook (Korean)');
  assert.equal(broadcastTitleLabel(title, 'ko', 'MBC PD수첩'), title);
  // 공유 채널 넷도 정본 이름(CTO 10-24) — 채널 이름(KBS Documentary channel 등)은 더 쓰지 않는다
  assert.equal(
    broadcastTitleLabel('대한민국 마약 근황 | KBS 더 보다 20251207 방송', 'en', 'KBS 다큐인사이트'),
    'KBS Docu Insight (Korean)',
  );
  assert.equal(broadcastTitleLabel(title, 'en', 'SBS 스페셜'), 'SBS Special (Korean)');
  assert.equal(broadcastTitleLabel(title, 'en', 'EBS 다큐프라임'), 'EBS Docuprime (Korean)');
  assert.equal(broadcastTitleLabel(title, 'en', 'KBS 시사기획 창'), 'KBS Current Affairs Window (Korean)');
  // 라틴이 없는 방송사는 표로 읽는다
  assert.equal(broadcasterLabel('뉴스타파', 'en'), 'Newstapa');
  // 표에 없으면 그전 그대로(빈칸 · 「Korean-language programme」)
  assert.equal(broadcasterLabel('연합뉴스TV', 'en'), '');
  assert.equal(broadcastTitleLabel(title, 'en', '연합뉴스TV'), 'Korean-language programme');
  // 연대기 응답 sourceEn(= 중독뉴스 program_en)이 실려 오면 표보다 먼저 — 글자 그대로(앞 방송사를 빼지 않음)
  assert.equal(
    broadcastTitleLabel(title, 'en', 'MBC PD수첩', { sourceEn: 'MBC PD Note' }),
    'MBC PD Note (Korean)',
  );
  assert.equal(broadcastTitleLabel(title, 'en', '뉴스타파', { sourceEn: 'Newstapa' }), 'Newstapa (Korean)');
  assert.equal(
    broadcastTitleLabel(title, 'en', 'KBS 다큐인사이트', { sourceEn: 'KBS Docu Insight' }),
    'KBS Docu Insight (Korean)',
  );
  // 한글이 섞인 sourceEn 은 버리고 표
  assert.equal(
    broadcastTitleLabel(title, 'en', 'KBS 다큐인사이트', { sourceEn: 'KBS 다큐인사이트' }),
    'KBS Docu Insight (Korean)',
  );
  // 표에 없고 라틴도 없는 방송사 → sourceEn 의 첫 낱말 · 한글이 섞인 값은 쓰지 않는다
  assert.equal(broadcasterLabel('새방송', 'en', { sourceEn: 'Saebangsong Weekly' }), 'Saebangsong');
  assert.equal(
    broadcastTitleLabel(title, 'en', '새방송', { sourceEn: 'Saebangsong Weekly' }),
    'Saebangsong Weekly (Korean)',
  );
  assert.equal(broadcasterLabel('MBC PD수첩', 'en', { sourceEn: '문화방송' }), 'MBC');
  assert.equal(broadcastTitleLabel(title, 'en', '연합뉴스TV', { sourceEn: '연합뉴스TV' }), 'Korean-language programme');
});

test('SOC-R14 ■1: /en broadcast line shows the broadcaster once — the slot is empty when the canon name holds it', () => {
  const ko = '도박 청소년이 성인이 되면 | PD수첩';
  // 9 채널 모두 정본 이름이 방송사를 품는다 → 방송사 칸 비움 · 제목 자리 하나
  for (const k of Object.keys(BROADCAST_NAMES_EN)) {
    const line = broadcastLineLabels({ title: ko, broadcaster: k }, 'en');
    assert.equal(line.org, '', k);
    assert.equal(line.title, `${BROADCAST_NAMES_EN[k].programEn} (Korean)`);
  }
  assert.deepEqual(
    broadcastLineLabels({ title: ko, broadcaster: 'KBS 다큐인사이트', sourceEn: 'KBS Docu Insight' }, 'en'),
    { org: '', title: 'KBS Docu Insight (Korean)' },
  );
  // 영어 원제가 제목이면 방송사는 그대로(제목에 방송사가 없음)
  assert.deepEqual(
    broadcastLineLabels({ title: 'Drug Crisis in Korea', broadcaster: 'KBS 다큐인사이트' }, 'en'),
    { org: 'KBS', title: 'Drug Crisis in Korea' },
  );
  // 표에 없는 방송사도 같은 규칙(방송사 칸 = sourceEn 첫 낱말 → 품음 → 비움)
  assert.deepEqual(
    broadcastLineLabels({ title: ko, broadcaster: '새방송', sourceEn: 'Saebangsong Weekly' }, 'en'),
    { org: '', title: 'Saebangsong Weekly (Korean)' },
  );
  // 품지 않으면 그대로(「MBCX」 처럼 낱말 경계가 아니면 품은 것이 아님)
  assert.deepEqual(
    broadcastLineLabels({ title: ko, broadcaster: 'MBC 새프로', sourceEn: 'MBCX Talk' }, 'en'),
    { org: 'MBC', title: 'MBCX Talk (Korean)' },
  );
  // 표에 없고 영어 이름도 없으면 그대로(빈 방송사 · 「Korean-language programme」)
  assert.deepEqual(broadcastLineLabels({ title: ko, broadcaster: '연합뉴스TV' }, 'en'), {
    org: '',
    title: 'Korean-language programme',
  });
  // 한국어 화면은 그대로
  assert.deepEqual(broadcastLineLabels({ title: ko, broadcaster: 'KBS 다큐인사이트' }, 'ko'), {
    org: 'KBS 다큐인사이트',
    title: ko,
  });
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
