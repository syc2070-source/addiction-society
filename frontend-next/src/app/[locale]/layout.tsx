import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '../globals.css';

/** ko/en 정적 생성 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * 사이트 기준 URL. Vercel 환경변수 NEXT_PUBLIC_SITE_URL로 지정
 * (도메인 전환 전에는 프리뷰/프로덕션 vercel.app URL, 전환 후 addictionsociety.net).
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** locale별 SEO 메타데이터 — OG + hreflang alternate 포함 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const path = locale === 'ko' ? '/' : `/${locale}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: path,
      languages: {
        ko: '/',
        en: '/en',
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Addiction Society',
      title: t('title'),
      description: t('description'),
      url: path,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // 정적 렌더링을 위해 요청 locale 고정
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <SiteHeader />
          {/* 콘텐츠는 페이지당 하나의 화이트 면 위에 올린다 (AS-UI-4, .content-plate) */}
          <div className="content-plate">{children}</div>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
