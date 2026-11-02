/**
 * 미리보기 전용 글 (SOC-R20) — messages/preview/{ko,en}.json.
 *
 * 왜 따로인가: 레이아웃이 messages/{locale}.json 전부를 클라이언트 제공자에 넘기므로, 거기 둔 글은
 * 지금 대문(/)의 응답에도 실린다(화면에는 안 보여도 HTML 안에). 「견본」 · 서재 카드 섹션 글이
 * 현 대문 응답에 0 이도록 미리보기 쪽(/preview/home · /evidence/<유형>) 서버에서만 이 파일을 읽는다.
 */
import { createTranslator } from 'next-intl';
import ko from '../../messages/preview/ko.json';
import en from '../../messages/preview/en.json';

const pick = (locale: string) => (locale === 'en' ? en : ko);

export const homeV3T = (locale: string) =>
  createTranslator({ locale, messages: pick(locale), namespace: 'homeV3' });

export const homeV4T = (locale: string) =>
  createTranslator({ locale, messages: pick(locale), namespace: 'homeV4' });

export const statoryT = (locale: string) =>
  createTranslator({ locale, messages: pick(locale), namespace: 'statory' });
