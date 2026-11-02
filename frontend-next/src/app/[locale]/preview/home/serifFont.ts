import { Noto_Serif_KR } from 'next/font/google';

/**
 * 제목만 세리프 (SOC-R20 ■1) — Noto Serif KR. next 에 들어 있는 next/font 로 빌드 때 받아 자체 호스팅(새 패키지 0).
 * 미리보기 쪽(/preview/home · /evidence/<유형>)에서만 부른다 — 지금 대문 글꼴은 그대로.
 * 미리 받지 않음(preload false · 한글 조각이 많다) · 못 받으면 serif 로 물러남.
 */
export const serifKr = Noto_Serif_KR({
  weight: '500',
  preload: false,
  display: 'swap',
  variable: '--font-serif-kr',
  fallback: ['serif'],
});
