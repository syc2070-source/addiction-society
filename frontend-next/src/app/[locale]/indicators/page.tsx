import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchIndicators } from '@/lib/api';

/** 지표 목록 (/indicators) — 블루프린트 제2장: "숫자는 무엇인가". 지표당 1페이지(SEO). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'indicatorsPage' });
  return { title: t('title') };
}

export default async function IndicatorsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/indicators'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;
  const sp = await searchParams;
  const domain = typeof sp.domain === 'string' ? sp.domain : undefined;

  const t = await getTranslations('indicatorsPage');
  const tc = await getTranslations('common');
  const result = await fetchIndicators({ domain });

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      {!result ? (
        <p className="status-note">{tc('unavailable')}</p>
      ) : result.data.length === 0 ? (
        <p className="status-note">{tc('collectingEmpty')}</p>
      ) : (
        <div className="list-grid">
          {result.data.map((ind) => (
            <Link
              key={ind.id}
              href={`/indicators/${ind.code}`}
              className="list-item"
            >
              <div className="list-item-meta">
                <span className="tag tag-org">{ind.domain}</span>
                {ind.unit && <span className="tag">{ind.unit}</span>}
                {typeof ind.observationCount === 'number' && (
                  <span>{t('obsCount', { count: ind.observationCount })}</span>
                )}
              </div>
              <h3 className="list-item-title">
                {l === 'en' && ind.nameEn ? ind.nameEn : ind.nameKo}
              </h3>
              {ind.definitionKo && (
                <p className="list-item-desc">
                  {ind.definitionKo.slice(0, 140)}
                  {ind.definitionKo.length > 140 ? '…' : ''}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
