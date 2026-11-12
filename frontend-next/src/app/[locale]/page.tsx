import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, type AppLocale } from '@/i18n/routing';
import type { Metadata } from 'next';
import HomeV4 from './preview/home/HomeV4';
import { selfAlternates } from '@/lib/pageMeta';

/**
 * 대문 / · /en (SOC-R22 ■2) — 전체 파랑 v4(R21 미리보기와 같은 HomeV4 · mode 'home').
 * 미리보기와 다른 점: 색인 열림(레이아웃 기본 메타 · noindex 0) · 글 = messages 본 글 ·
 * Statory 서재는 실물 묶음(frontend-next/data/statory/evidence_export_v1.json)이 있을 때만 — 견본 0 · 없으면 구간 0.
 * 옛 대문(R19 까지 · _legacy/HomeV1.tsx)은 SOC-R23 ■1 에서 지움(태그 pre-remove-soc-legacy-20261111 에 남음).
 * 다시 그리기: /api/revalidate/home 이 '/[locale]' 를 비운다(04:00 · 00:05).
 */

/** 대문의 canonical = / · /en (SOC-R24 ■5 — 레이아웃은 이제 박지 않는다) */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: selfAlternates(locale, '') };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);
  return <HomeV4 locale={locale as AppLocale} mode="home" />;
}
