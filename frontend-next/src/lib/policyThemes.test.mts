// SOC-R24 ■3 — 정책 쪽 ⑥ 주제 둘(사례관리 · 예방 프로그램) 낱말 규칙. 모델 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardsOfTheme, isTheme, themeCounts, THEMES } from './policyThemes.ts';

const card = (title: string, findings_ko: string | null = null) => ({ title, findings_ko });

test('case management: Korean and English forms, not "case" alone', () => {
  const hit = (s: string) => cardsOfTheme([card(s)], 'case-management').length === 1;
  assert.ok(hit('통합사례관리 접근법 효과성'));
  assert.ok(hit('사례 관리 서비스 이용'));
  assert.ok(hit('Effectiveness of case management for substance users'));
  assert.ok(hit('Case-managed referral'));
  assert.ok(!hit('A case-control study of drinking'));
  assert.ok(!hit('Showcase management of risk'));
});

test('prevention programme: programme, education, intervention, school-based; not bare "prevention"', () => {
  const hit = (s: string) => cardsOfTheme([card(s)], 'prevention-program').length === 1;
  assert.ok(hit('청소년 마약류 예방교육 콘텐츠'));
  assert.ok(hit('도박 예방 프로그램의 효과'));
  assert.ok(hit('A systematic review of prevention programs for children'));
  assert.ok(hit('School-based prevention of gambling'));
  assert.ok(!hit('Relapse prevention after detox'));
  assert.ok(!hit('예방 효과가 있었다'));
});

test('findings_ko counts too; zero-card themes are left out', () => {
  assert.equal(cardsOfTheme([card('x', '사례관리 대상자 120명')], 'case-management').length, 1);
  assert.deepEqual(themeCounts([card('예방교육'), card('예방 프로그램'), card('nothing')]), [
    { theme: 'prevention-program', n: 2 },
  ]);
  assert.deepEqual(themeCounts([]), []);
  assert.ok(THEMES.every(isTheme));
  assert.ok(!isTheme('policy'));
});
