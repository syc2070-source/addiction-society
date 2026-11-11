import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, type AppLocale } from '@/i18n/routing';
import { homeV4T } from '@/lib/previewMessages';
import HomeV4 from './HomeV4';

/**
 * 홈 v4 미리보기 (SOC-R21 지음 · R22 부터 본문은 HomeV4 하나를 대문과 함께 씀) — /preview/home · /en/preview/home.
 * 대문과 다른 점: noindex 그대로 · 글 = messages/preview(Statory 카드는 대문과 같은 실물 · 견본 길 SOC-R23 지움).
 * (R19 TenYearChart · v2.module.css · 옛 대문 HomeV1 은 SOC-R23 ■1 에서 지움 · 태그 pre-remove-soc-legacy-20261111)
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = homeV4T(locale);
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    alternates: { canonical: locale === 'ko' ? '/' : `/${locale}` },
  };
}

export default async function HomeV4PreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);
  return <HomeV4 locale={locale as AppLocale} mode="preview" />;
}
