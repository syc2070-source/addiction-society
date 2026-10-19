import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchReport, type ReportSection } from '@/lib/api';
import PoweredByStatory from '@/components/PoweredByStatory';
import {
  englishOrEmpty,
  labSummaryLabel,
  reportTitleLabel,
} from '@/lib/enLabels';

/** 분석실 상세 — sections_json(텍스트 섹션) 단순 렌더 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const result = await fetchReport(id);
  if (result?.item) {
    return { title: reportTitleLabel(result.item, locale) };
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
    l === 'en' && s.title_en ? s.title_en : englishOrEmpty(s.title, l);
  // SOC-R9: en 은 영어 본문만(한국어뿐인 칸은 비움)
  const sectionText = (s: ReportSection) => {
    const c = s.content;
    if (!c) return null;
    return l === 'en'
      ? englishOrEmpty(c.text_en, l) || null
      : c.text_ko || c.text_en;
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
            <div className="page-kicker" style={{ marginTop: 'var(--space-2)' }}>
              {t('kicker')}
            </div>
            <h1 className="page-title">
              {reportTitleLabel(report, l)}
            </h1>
            {report.published_at && (
              <p className="list-item-meta">
                <span className="tag">{report.published_at.slice(0, 10)}</span>
              </p>
            )}
            {labSummaryLabel(report, l) && (
              <p className="page-desc">{labSummaryLabel(report, l)}</p>
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

            {englishOrEmpty(report.conclusion_ko, l) && (
              <section className="report-section">
                <p>{englishOrEmpty(report.conclusion_ko, l)}</p>
              </section>
            )}
          </>
        )}

        <PoweredByStatory />
      </div>
    </main>
  );
}
