// SOC-R21 — 서재 규모 합 · 파랑 한 벌 대비(globals.css 값으로 계산) · 미리보기 흰·종이색 바탕 0 · 현 대문 표식 0. 모델 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libraryScale } from './homeV4.ts';

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
  const page = read('src', 'app', '[locale]', 'preview', 'home', 'page.tsx');
  assert.ok(!/from '\.\/v2\.module\.css'/.test(page), 'v2 (white/paper) styles not imported');
  assert.ok(page.includes('blue-preview'));
  // 레이아웃 판·머리·바닥을 파랑으로 바꾸는 규칙은 표식이 있는 쪽에만
  const overrides = css.split('\n').filter((ln) => /\.content-plate|\.site-header|\.site-footer|^body/.test(ln) && ln.includes('{'));
  for (const ln of overrides.filter((x) => x.includes('blue'))) assert.match(ln, /body:has\(\.blue-preview\)/);
});

test('current home never carries the blue-preview marker', () => {
  const home = read('src', 'app', '[locale]', 'page.tsx');
  assert.ok(!home.includes('blue-preview'));
  assert.ok(!/homeV4|previewMessages/.test(home));
});
