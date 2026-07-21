import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { fetchCalendar, fetchSources, type Source } from '@/lib/api';

/**
 * 발표 캘린더 (/calendar) — 기존 SourceCalendar.tsx 이식.
 * 월별 그룹 + 미정 그룹 + ★ 기사화 우선(한국·1차 소스).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'calendarPage' });
  return { title: t('title') };
}

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** ★ 기사화 우선순위: 1차 소스 AND 한국 */
const isStar = (s: Source) => s.reliability === 1 && s.scope === 'korea';

export default async function CalendarPage({
  params,
}: PageProps<'/[locale]/calendar'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations('calendarPage');
  const ts = await getTranslations('sources');
  const tc = await getTranslations('common');

  // 예정(임박순) + 미정 그룹 도출용 전체 목록
  const [scheduled, all] = await Promise.all([fetchCalendar(), fetchSources({})]);
  const undated = (all?.data ?? []).filter((s) => !s.nextExpectedAt);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const mi = parseInt(m, 10);
    return l === 'en'
      ? t('month', { year: y, month: EN_MONTHS[mi - 1] })
      : t('month', { year: y, month: mi });
  };

  const title = (s: Source) => (l === 'en' && s.titleEn ? s.titleEn : s.titleKo);

  const groups: Record<string, Source[]> = {};
  (scheduled ?? []).forEach((s) => {
    const key = String(s.nextExpectedAt || '').slice(0, 7);
    (groups[key] ??= []).push(s);
  });
  const monthKeys = Object.keys(groups).sort();

  const failed = scheduled === null && all === null;

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      {failed ? (
        <p className="status-note">{tc('unavailable')}</p>
      ) : monthKeys.length === 0 && undated.length === 0 ? (
        <p className="status-note">{tc('collecting')}</p>
      ) : (
        <>
          {monthKeys.map((mk) => (
            <div key={mk} style={{ marginBottom: '24px' }}>
              <h2 className="group-heading">{monthLabel(mk)}</h2>
              <div className="list-grid">
                {groups[mk].map((s) => (
                  <div key={s.id} className="list-item">
                    <div className="list-item-meta">
                      <span className="tag tag-org">
                        {l === 'en' ? s.org : s.orgKo || s.org}
                      </span>
                      <span className="tag">{ts(`scope.${s.scope}`)}</span>
                      {isStar(s) && <span className="tag tag-warn">{t('star')}</span>}
                    </div>
                    <h3 className="list-item-title">
                      {isStar(s) ? '★ ' : ''}
                      {title(s)}
                    </h3>
                    <p className="list-item-desc" style={{ margin: 0 }}>
                      {t('scheduledFor', {
                        ym: String(s.nextExpectedAt).slice(0, 7),
                      })}
                      {l === 'ko' && s.titleEn ? ` · ${s.titleEn}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 미정 그룹 (next_expected_at null — irregular 및 발표시점 미상) */}
          {undated.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h2 className="group-heading">{t('undatedGroup')}</h2>
              <div className="list-grid">
                {undated.map((s) => (
                  <div key={s.id} className="list-item" style={{ opacity: 0.75 }}>
                    <div className="list-item-meta">
                      <span className="tag tag-org">
                        {l === 'en' ? s.org : s.orgKo || s.org}
                      </span>
                      <span className="tag">{ts(`scope.${s.scope}`)}</span>
                      <span className="tag">
                        {s.cadence === 'irregular'
                          ? ts('cadence.irregular')
                          : tc('collecting')}
                      </span>
                      {isStar(s) && <span className="tag tag-warn">★</span>}
                    </div>
                    <h3 className="list-item-title">
                      {isStar(s) ? '★ ' : ''}
                      {title(s)}
                    </h3>
                    <p className="list-item-desc" style={{ margin: 0 }}>
                      {t('undated')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
