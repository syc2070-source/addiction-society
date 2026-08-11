import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { fetchTimeline, type TimelineEvent } from '@/lib/api';

/** 관측소 활동 연대기 (/timeline) — 감지·감시 이력(source_events)을 시간순으로.
 *  발표달력이 "언제 나올까"라면 연대기는 "언제 무엇이 일어났나"의 집적. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'timelinePage' });
  return { title: t('title') };
}

export default async function TimelinePage({
  params,
}: PageProps<'/[locale]/timeline'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations('timelinePage');
  const tc = await getTranslations('common');
  const result = await fetchTimeline({ limit: 200 });

  const sourceName = (e: TimelineEvent) =>
    l === 'en' ? e.titleEn || e.titleKo || e.sourceId : e.titleKo || e.sourceId;
  const fmt = (iso: string) => iso.slice(0, 10);

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      {/*
        활동 요약 (AS-FIX-1, 감사 문제 #8).
        의미 있는 사건이 없는 달에도 "확인은 돌고 있다"가 화면에 드러나야
        크론이 도는 중인지 죽었는지 구분된다. 값이 없으면 아무것도 그리지 않는다.
      */}
      {result?.summary && result.summary.total > 0 && (
        <p className="status-note">
          {t('activity', {
            days: result.summary.periodDays,
            checks: result.summary.total,
            sources: result.summary.sourcesChecked,
          })}
          {result.summary.lastEventAt
            ? ` · ${t('lastCheck', { date: fmt(result.summary.lastEventAt) })}`
            : ''}
        </p>
      )}

      {!result ? (
        <p className="status-note">{tc('unavailable')}</p>
      ) : result.data.length === 0 ? (
        <p className="status-note">
          {result.summary && result.summary.total > 0
            ? t('quiet')
            : tc('collectingEmpty')}
        </p>
      ) : (
        <ul className="timeline-list">
          {result.data.map((e) => (
            <li key={e.id} className="timeline-item">
              <span className="timeline-date">{fmt(e.detectedAt)}</span>
              <span className={`timeline-badge badge-${e.eventType}`}>
                {t(`event.${e.eventType}`)}
              </span>
              <span className="timeline-body">
                <span className="timeline-org">
                  {l === 'en' ? e.org || e.orgKo : e.orgKo || e.org}
                </span>
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="timeline-source"
                  >
                    {sourceName(e)}
                  </a>
                ) : (
                  <span className="timeline-source">{sourceName(e)}</span>
                )}
                {e.newPublishedAt && (
                  <span className="timeline-pub">
                    {t('publishedAt', { date: e.newPublishedAt })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
