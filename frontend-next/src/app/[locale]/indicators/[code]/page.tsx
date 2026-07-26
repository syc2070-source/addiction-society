import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchIndicator } from '@/lib/api';

/** 지표 상세 (/indicators/{code}) — 정의·출처 + 관측치 시계열(표). 모든 값에 원본 딥링크(원칙3). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}): Promise<Metadata> {
  const { locale, code } = await params;
  const result = await fetchIndicator(code);
  if (result?.indicator) {
    const title =
      locale === 'en' && result.indicator.nameEn
        ? result.indicator.nameEn
        : result.indicator.nameKo;
    return { title };
  }
  const t = await getTranslations({ locale, namespace: 'indicatorsPage' });
  return { title: t('title') };
}

export default async function IndicatorDetailPage({
  params,
}: PageProps<'/[locale]/indicators/[code]'>) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations('indicatorsPage');
  const tc = await getTranslations('common');
  const result = await fetchIndicator(code);
  const indicator = result?.indicator ?? null;
  const observations = result?.observations ?? [];

  return (
    <main className="page-container">
      <div className="page-header">
        <Link href="/indicators" className="ext-link">
          {t('backToList')}
        </Link>

        {!result ? (
          <p className="status-note">{tc('unavailable')}</p>
        ) : !indicator ? (
          <p className="status-note">{t('notFound')}</p>
        ) : (
          <>
            <div className="page-kicker" style={{ marginTop: 12 }}>
              {indicator.domain}
              {indicator.unit ? ` · ${indicator.unit}` : ''}
            </div>
            <h1 className="page-title">
              {l === 'en' && indicator.nameEn
                ? indicator.nameEn
                : indicator.nameKo}
            </h1>

            <section className="report-section">
              <h2>{t('definition')}</h2>
              <p>{indicator.definitionKo}</p>
              {indicator.methodNote && (
                <p className="list-item-meta">{indicator.methodNote}</p>
              )}
            </section>

            <section className="report-section">
              <h2>{t('series')}</h2>
              {observations.length === 0 ? (
                <p className="status-note">{tc('collectingEmpty')}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('colGeo')}</th>
                        <th>{t('colPeriod')}</th>
                        <th>{t('colValue')}</th>
                        <th>{t('colSource')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {observations.map((o) => (
                        <tr key={o.id}>
                          <td>{o.geo}</td>
                          <td>{o.period}</td>
                          <td>
                            {o.value}
                            {indicator.unit ? ` ${indicator.unit}` : ''}
                            {o.valueLow && o.valueHigh
                              ? ` (${o.valueLow}–${o.valueHigh})`
                              : ''}
                            {o.qualifier ? ` · ${o.qualifier}` : ''}
                          </td>
                          <td>
                            <a
                              href={o.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ext-link"
                            >
                              {tc('viewOriginal')}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
