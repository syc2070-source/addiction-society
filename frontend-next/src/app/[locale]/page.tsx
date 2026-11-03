import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, type AppLocale } from '@/i18n/routing';
import HomeV4 from './preview/home/HomeV4';

/**
 * 대문 / · /en (SOC-R22 ■2) — 전체 파랑 v4(R21 미리보기와 같은 HomeV4 · mode 'home').
 * 미리보기와 다른 점: 색인 열림(레이아웃 기본 메타 · noindex 0) · 글 = messages 본 글 ·
 * Statory 서재는 실물 묶음(frontend-next/data/statory/evidence_export_v1.json)이 있을 때만 — 견본 0 · 없으면 구간 0.
 * 옛 대문(R19 까지)은 _legacy/HomeV1.tsx 에 남아 있고 부르지 않는다(지움 0).
 * 다시 그리기: /api/revalidate/home 이 '/[locale]' 를 비운다(04:00 · 00:05).
 */

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);
  return <HomeV4 locale={locale as AppLocale} mode="home" />;
}
