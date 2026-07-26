import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** 소개 (/about) — 발행처 명칭·주소 + 플레이스홀더. 상세 소개문은 후속. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'aboutPage' });
  return { title: t('title') };
}

export default async function AboutPage({
  params,
}: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('aboutPage');

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
      </div>

      <section className="report-section">
        <h2>{t('orgName')}</h2>
        <p className="list-item-meta">
          {t('addressLabel')}: {t('address')}
        </p>
        <p className="page-desc">{t('placeholder')}</p>
      </section>
    </main>
  );
}
