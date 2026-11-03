// SOC-R21 — 서재 규모 합 · 파랑 한 벌 대비(globals.css 값으로 계산) · 미리보기 흰·종이색 바탕 0 · 현 대문 표식 0. 모델 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libraryScale, showTypeLabel } from './homeV4.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('library size = sum of the stored topic counts; any missing cell → no line', () => {
  const a = { studies: 747, openAccess: 259, trend: { lastFive: 220 } };
  const b = { studies: 7523, openAccess: 1712, trend: { lastFive: 2202 } };
  assert.deepEqual(libraryScale([a, b]), { topics: 2, studies: 8270, openAccess: 1971, lastFive: 2422 });
  assert.equal(libraryScale([a, null]), null);
  assert.equal(libraryScale([a, { ...b, openAccess: null }]), null);
  assert.equal(libraryScale([a, { ...b, trend: null }]), null);
  assert.equal(libraryScale([]), null);
});

const css = read('src', 'app', 'globals.css');
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(m, `token --${name}`);
  return m[1];
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const Y = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [Y(a), Y(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('blue set: text ≥ 4.5:1 and type colours ≥ 3:1 on every blue step and the card', () => {
  const surfaces = ['blue-0', 'blue-up', 'blue-down', 'blue-deep', 'blue-card'].map(token);
  for (const t of ['blue-text', 'blue-muted', 'blue-accent', 'blue-link']) {
    for (const s of surfaces) assert.ok(contrast(token(t), s) >= 4.5, `${t} on ${s}`);
  }
  for (const k of ['alcohol', 'gambling', 'drug', 'smartphone', 'game', 'tobacco']) {
    for (const s of surfaces) assert.ok(contrast(token(`type-${k}-blue`), s) >= 3, `${k} on ${s}`);
  }
  assert.ok(contrast(token('blue-on-link'), token('blue-link')) >= 4.5, 'search button text');
});

test('preview has no white or paper background (only the search input is white)', () => {
  const v4 = read('src', 'app', '[locale]', 'preview', 'home', 'v4.module.css');
  assert.equal((v4.match(/#fff(fff)?\b/gi) ?? []).length, 1);
  assert.ok(!/--bg-alt|--card-bg|--bg\)/.test(v4));
  // R22: 본문은 HomeV4.tsx 하나(대문 · 미리보기 둘 다)
  const page = read('src', 'app', '[locale]', 'preview', 'home', 'HomeV4.tsx');
  assert.ok(!/from '\.\/v2\.module\.css'/.test(page), 'v2 (white/paper) styles not imported');
  assert.ok(page.includes('blue-preview'));
  // 레이아웃 판·머리·바닥을 파랑으로 바꾸는 규칙은 표식이 있는 쪽에만
  const overrides = css.split('\n').filter((ln) => /\.content-plate|\.site-header|\.site-footer|^body/.test(ln) && ln.includes('{'));
  for (const ln of overrides.filter((x) => x.includes('blue'))) assert.match(ln, /body:has\(\.blue-preview\)/);
});

// R22 ■2: 대문이 v4 로 — R21 의 「대문에 표식 0」을 바꿈. 표식은 한 길(.blue-preview · HomeV4 가 단다) · 옛 대문은 부르지 않음.
test('home renders HomeV4 (blue marker one way) and never calls the old home', () => {
  const home = read('src', 'app', '[locale]', 'page.tsx');
  assert.match(home, /import HomeV4 from '\.\/preview\/home\/HomeV4'/);
  assert.ok(!/_legacy/.test(home.replace(/\/\*[\s\S]*?\*\//g, '')), 'old home not imported');
  const legacy = read('src', 'app', '[locale]', '_legacy', 'HomeV1.tsx');
  assert.ok(legacy.length > 1000, 'old home kept (지움 0)');
});

test('indicator line: type label is dropped when the indicator name already starts with it', () => {
  assert.equal(showTypeLabel('게임', '게임 이용률 (최근 1년)'), false);
  assert.equal(showTypeLabel('스마트폰', '스마트폰 과의존 위험군 비율'), false);
  assert.equal(showTypeLabel('Smartphone', 'Smartphone overdependence risk group rate'), false);
  assert.equal(showTypeLabel('마약', '마약류 사범 단속 인원'), false);
  assert.equal(showTypeLabel('알코올', '성인 고위험음주율'), true);
  assert.equal(showTypeLabel('Gaming', 'Game usage rate'), true);
});
