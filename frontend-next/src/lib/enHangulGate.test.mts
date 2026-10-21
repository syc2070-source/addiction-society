// SOC-R9 ■1 관문 — en 빌드 산출 HTML 한글 0 (출처 고유명 허용 목록만 예외).
// 실행: npm test (빌드 산출 없으면 산출 검사는 건너뜀) · npm run test:en (next build 뒤 · 산출 필수)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hangulLeaks, sourceProperNames, visibleTexts } from './enHangulGate.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const seed = readFileSync(
  new URL('../../../backend/src/sources/seed/sources.seed.ts', import.meta.url),
  'utf8',
);
const ALLOW = sourceProperNames(seed);
/** API 를 못 읽은 쪽(빈 쪽)은 한글 0 이어도 검사가 아니다 — common.unavailable */
const UNAVAILABLE = 'Failed to load data';
const unavailable = (html: string) =>
  visibleTexts(html).some((t) => t.includes(UNAVAILABLE));

test('visible text: body text and visible attributes count, scripts do not', () => {
  const html =
    '<html><head><meta name="description" content="설명"><script>self.__next_f.push("한국어")</script>' +
    '<style>.a::after{content:"가"}</style></head><body><a>Korean</a>' +
    '<img alt="중독사회 addiction society"><p>세계마약보고서</p><input placeholder="검색"></body></html>';
  const texts = visibleTexts(html);
  assert.ok(texts.includes('Korean'));
  assert.ok(texts.includes('중독사회 addiction society'));
  assert.ok(texts.includes('검색'));
  assert.ok(!texts.some((t) => t.includes('한국어')));
  assert.deepEqual(
    hangulLeaks(html, ALLOW).sort(),
    ['검색', '설명', '중독사회 addiction society'].sort(),
  );
});

test('allow list = Korean proper names of the 24 sources only', () => {
  assert.equal(ALLOW.length, 48);
  assert.ok(ALLOW.includes('세계마약보고서'));
  assert.ok(ALLOW.includes('대검찰청'));
  assert.deepEqual(hangulLeaks('<p>세계마약보고서</p><p>&#xB9C8;약류 월간동향</p>', ALLOW), []);
  // 고유명에 다른 한글이 붙으면 걸린다
  assert.deepEqual(hangulLeaks('<p>세계마약보고서 발간</p>', ALLOW), ['세계마약보고서 발간']);
});

function htmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return f.endsWith('.html') ? [p] : [];
  });
}

test('built /en pages have no Hangul except source proper names', (t) => {
  const app = join(root, '.next', 'server', 'app');
  const files = [join(app, 'en.html'), ...htmlFiles(join(app, 'en'))].filter((f) =>
    existsSync(f),
  );
  if (files.length === 0) {
    if (process.env.EN_GATE_REQUIRE) assert.fail('no en build output — run next build first');
    t.skip('no en build output (run npm run build, then npm run test:en)');
    return;
  }
  const leaks: string[] = [];
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    if (unavailable(html)) {
      leaks.push(`${f.slice(app.length + 1)}: built without API data`);
    }
    for (const text of hangulLeaks(html, ALLOW)) {
      leaks.push(`${f.slice(app.length + 1)}: ${text.slice(0, 120)}`);
    }
  }
  assert.ok(files.length >= 9, `en pages ${files.length}`);
  assert.deepEqual(leaks, []);
});

/**
 * 요청 때 그리는 en 쪽(지표·정책·회복·연구·출처·연구실 상세)은 빌드 산출에 HTML 이 없다.
 * EN_GATE_BASE_URL(next start 또는 운영 주소)이 있으면 그 쪽들을 받아 같은 잣대로 본다.
 */
function dynamicPaths(): string[] {
  const dir = new URL('../../../backend/src/indicators/seed/', import.meta.url);
  const codes = readdirSync(dir)
    .filter((f) => f.endsWith('.data.json'))
    .flatMap(
      (f) =>
        (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as {
          indicators: { code: string }[];
        }).indicators.map((i) => i.code),
    );
  const labIds = [
    'b1000002-0002-4002-8002-000000000002',
    'b1000001-0001-4001-8001-000000000001',
  ];
  return [
    // SOC-R10: 밤 예약이 새 행(방송 등)을 넣는 쪽 — 빌드 뒤 ISR 로 바뀌므로 요청 때도 본다
    '/en',
    '/en/timeline',
    '/en/indicators',
    ...codes.map((c) => `/en/indicators/${c}`),
    '/en/policy',
    '/en/policy?page=2',
    ...[1, 2, 3, 4].map((p) => `/en/recovery?page=${p}`),
    '/en/research',
    '/en/sources',
    ...labIds.map((id) => `/en/lab/${id}`),
  ];
}

test('built /en pages served on request have no Hangul except source proper names', async (t) => {
  const base = process.env.EN_GATE_BASE_URL?.replace(/\/+$/, '');
  if (!base) {
    if (process.env.EN_GATE_REQUIRE) assert.fail('EN_GATE_BASE_URL not set');
    t.skip('EN_GATE_BASE_URL not set (next start, then npm run test:en)');
    return;
  }
  const leaks: string[] = [];
  for (const p of dynamicPaths()) {
    const res: Response = await fetch(base + p, {
      signal: AbortSignal.timeout(90_000),
    });
    assert.equal(res.status, 200, p);
    const html = await res.text();
    if (unavailable(html)) leaks.push(`${p}: rendered without API data`);
    for (const text of hangulLeaks(html, ALLOW)) {
      leaks.push(`${p}: ${text.slice(0, 120)}`);
    }
  }
  assert.deepEqual(leaks, []);
});
