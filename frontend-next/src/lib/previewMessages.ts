/**
 * 홈 v4 · Statory 서재 글 — 두 곳(SOC-R20 · R22).
 *
 *  main    = messages/{ko,en}.json 의 homeV3 · homeV4 · statory (R22 ■2 대문 · 실물 카드 쪽) — 「견본」 글은 넣지 않는다.
 *  preview = messages/preview/{ko,en}.json (미리보기 · 견본 띠 · 「견본 A」 제목) — 견본 글은 여기에만.
 *
 * 왜 둘인가: 레이아웃이 messages/{locale}.json 전부를 모든 쪽 응답에 싣는다. 견본 글을 거기 두면 대문 응답에 「견본」이 실린다(R20 ■5).
 * 서버에서 createTranslator 로 읽는다. 두 파일의 꼴(TS 타입)이 조금 달라 부르는 쪽 타입은 느슨한 하나(Tr)로 묶는다.
 */
import { createTranslator } from 'next-intl';
import ko from '../../messages/preview/ko.json';
import en from '../../messages/preview/en.json';
import mainKo from '../../messages/ko.json';
import mainEn from '../../messages/en.json';

export type TextSource = 'main' | 'preview';
export type Tr = (key: string, values?: Record<string, string | number>) => string;

const pick = (locale: string) => (locale === 'en' ? en : ko);
const pickMain = (locale: string) => (locale === 'en' ? mainEn : mainKo);

function loose(locale: string, source: TextSource, namespace: 'homeV3' | 'homeV4' | 'statory'): Tr {
  const raw =
    source === 'main'
      ? createTranslator({ locale, messages: pickMain(locale), namespace })
      : createTranslator({ locale, messages: pick(locale), namespace });
  const call = raw as unknown as (k: string, v?: Record<string, string | number>) => string;
  return (key, values) => call(key, values);
}

/** 미리보기 쪽 꼴 그대로(정확한 키 타입) — R20 부르던 곳 */
export const homeV3T = (locale: string) =>
  createTranslator({ locale, messages: pick(locale), namespace: 'homeV3' });

export const homeV4T = (locale: string) =>
  createTranslator({ locale, messages: pick(locale), namespace: 'homeV4' });

/** 글 자리를 고르는 판(R22) */
export const homeV3Text = (locale: string, source: TextSource) => loose(locale, source, 'homeV3');
export const homeV4Text = (locale: string, source: TextSource) => loose(locale, source, 'homeV4');
export const statoryText = (locale: string, source: TextSource) => loose(locale, source, 'statory');

/** R20 이름 — 미리보기(견본 띠 포함) */
export const statoryT = (locale: string) => statoryText(locale, 'preview');
