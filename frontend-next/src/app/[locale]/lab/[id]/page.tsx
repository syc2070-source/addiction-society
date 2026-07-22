import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchReport, type ReportSection } from '@/lib/api';
import PoweredByStatory from '@/components/PoweredByStatory';

/** 분석실 상세 — sections_json(텍스트 섹션) 단순 렌더 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const result = await fetchReport(id);
  if (result?.item) {
    const title =
      locale === 'en' && result.item.title_en
        ? result.item.title_en
        : result.item.title_ko;
    return { title };
  }
  const t = await getTranslations({ locale, namespace: 'labPage' });
  return { title: t('title') };
}

export default async function LabDetailPage({
  params,
}: PageProps<'/[locale]/lab/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations('labPage');
  const tc = await getTranslations('common');
  const result = await fetchReport(id);
  const report = result?.item ?? null;

  const sectionTitle = (s: ReportSection) =>
    l === 'en' && s.title_en ? s.title_en : s.title;
  const sectionText = (s: ReportSection) => {
    const c = s.content;
    if (!c) return null;
    return l === 'en' ? c.text_en || c.text_ko : c.text_ko || c.text_en;
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <Link href="/lab" className="ext-link">
          {t('backToList')}
        </Link>

        {!result ? (
          <p className="status-note">{tc('unavailable')}</p>
        ) : !report ? (
          <p className="status-note">{t('notFound')}</p>
        ) : (
          <>
            <div className="page-kicker" style={{ marginTop: 12 }}>
              {t('kicker')}
            </div>
            <h1 className="page-title">
              {l === 'en' && report.title_en ? report.title_en : report.title_ko}
            </h1>
            {report.published_at && (
              <p className="list-item-meta">
                <span className="tag">{report.published_at.slice(0, 10)}</span>
              </p>
            )}
            {report.summary_ko && (
              <p className="page-desc">{report.summary_ko}</p>
            )}

            {(report.sections_json ?? []).map((s, i) => {
              const text = sectionText(s);
              if (!text) return null;
              return (
                <section key={i} className="report-section">
                  <h2>{sectionTitle(s)}</h2>
                  <p>{text}</p>
                </section>
              );
            })}

            {report.conclusion_ko && (
              <section className="report-section">
                <p>{report.conclusion_ko}</p>
              </section>
            )}
          </>
        )}

        <PoweredByStatory />
      </div>
    </main>
  );
}
