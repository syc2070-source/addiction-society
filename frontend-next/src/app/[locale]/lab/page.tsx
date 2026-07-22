import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchReports, type Report } from '@/lib/api';
import PoweredByStatory from '@/components/PoweredByStatory';

/**
 * 분석실 (/lab) — statory 프록시(GET /api/reports) 결과물의 전시장.
 * 최소 개설: 목록 카드만. 자동 시리즈(P5)는 이번 범위 아님.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'labPage' });
  return { title: t('title') };
}

export default async function LabPage({ params }: PageProps<'/[locale]/lab'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations('labPage');
  const tc = await getTranslations('common');
  const result = await fetchReports();

  const title = (r: Report) =>
    l === 'en' && r.title_en ? r.title_en : r.title_ko;

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      {!result ? (
        <p className="status-note">{tc('unavailable')}</p>
      ) : result.items.length === 0 ? (
        <p className="status-note">{tc('collecting')}</p>
      ) : (
        <div className="list-grid">
          {result.items.map((r) => (
            <Link
              key={r.id}
              href={`/lab/${r.id}`}
              className="list-item"
            >
              <div className="list-item-meta">
                {r.published_at && (
                  <span className="tag">{r.published_at.slice(0, 10)}</span>
                )}
                {r.sections_count > 0 && (
                  <span className="tag">
                    {t('sections', { count: r.sections_count })}
                  </span>
                )}
              </div>
              <h3 className="list-item-title">{title(r)}</h3>
              {r.summary_ko && (
                <p className="list-item-desc">{r.summary_ko}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      <PoweredByStatory />
    </main>
  );
}
