import { defineRouting } from 'next-intl/routing';

/**
 * ko/en 라우팅 규칙.
 * - ko가 기본이며 URL 접두사 없음(`/`), 영어만 `/en` 접두사(as-needed).
 * - 블루프린트 제5장: "URL 구조에 locale을 처음부터".
 * - qaicle-v2(next-intl + [locale] 세그먼트)와 같은 계열 — 1인 운영 학습 전이.
 */
export const routing = defineRouting({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  localePrefix: 'as-needed',
  // 브라우저 언어 기반 자동 리다이렉트 금지: '/'는 언제나 ko.
  // (검색엔진·공유 링크의 예측 가능성이 감지보다 중요하다는 판단)
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
