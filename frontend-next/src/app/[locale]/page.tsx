import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, type AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchSourcesSummary, type SummaryItem } from '@/lib/api';
import { MINISTRY_MAP } from '@/data/ministry-map';
import styles from './page.module.css';

/**
 * 홈 (F-1): 히어로 + 관측소 카드(운영 API) + 부처 분산 지도(M0 확정 콘텐츠).
 * 서버 컴포넌트 — summary는 SSR fetch(5분 재검증), 실패 시 "수집 중"(가짜 데이터 금지).
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);

  const t = await getTranslations();
  const summary = await fetchSourcesSummary();

  const rich = {
    hl: (chunks: React.ReactNode) => (
      <span className={styles.highlight}>{chunks}</span>
    ),
    b: (chunks: React.ReactNode) => <b>{chunks}</b>,
  };

  const renderObsRows = (
    items: SummaryItem[] | undefined,
    mode: 'recent' | 'upcoming',
  ) => {
    if (!items || items.length === 0) {
      return (
        <div className={styles.obsRow}>
          <span className={styles.obsLabel}>{t('obs.collecting')}</span>
        </div>
      );
    }
    return items.map((it) => (
      <div key={it.id} className={styles.obsRow}>
        <span className={styles.obsDate}>
          {mode === 'upcoming' ? it.date.slice(0, 7) : it.date}
        </span>
        <span className={styles.obsLabel}>{it.label}</span>
      </div>
    ));
  };

  const l = locale as AppLocale;

  return (
    <main className={styles.main}>
      {/* 언어 전환 (ko ↔ en) */}
      <nav className={styles.localeSwitch} aria-label="Language">
        <Link
          href="/"
          locale="ko"
          className={l === 'ko' ? styles.localeActive : undefined}
        >
          한국어
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/"
          locale="en"
          className={l === 'en' ? styles.localeActive : undefined}
        >
          English
        </Link>
      </nav>

      {/* 히어로 */}
      <section className={styles.hero}>
        <div>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            <span className={styles.badgeLabel}>{t('hero.badgeLabel')}</span>
            <span className={styles.badgeDesc}>{t('hero.badgeDesc')}</span>
          </div>
          <h1 className={styles.heroTitle}>
            {t.rich('hero.line1', rich)}
            <br />
            {t.rich('hero.line2', rich)}
          </h1>
          <p className={styles.heroSubtitle}>{t.rich('hero.subtitle', rich)}</p>
        </div>

        {/* 관측소 카드 — GET /api/sources/summary */}
        <aside className={styles.obsCard}>
          <div className={styles.obsHeader}>
            <div>
              <div className={styles.obsTitle}>{t('obs.title')}</div>
              <div className={styles.obsSub}>
                {summary
                  ? t('obs.subtitle', { total: summary.total })
                  : t('obs.subtitleCollecting')}
              </div>
            </div>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} />
              {t('obs.live')}
            </div>
          </div>

          <div className={styles.obsBlock}>
            <div className={styles.obsBlockTitle}>{t('obs.recent')}</div>
            {renderObsRows(summary?.recent, 'recent')}
          </div>

          <div className={styles.obsBlock}>
            <div className={styles.obsBlockTitle}>{t('obs.upcoming')}</div>
            {renderObsRows(summary?.upcoming, 'upcoming')}
          </div>
        </aside>
      </section>

      {/* 부처 분산 지도 (M0 확정: 표 + 인용구 + 각주) */}
      <section className={styles.section}>
        <div className={styles.kicker}>{t('ministry.kicker')}</div>
        <h2 className={styles.sectionTitle}>{t('ministry.title')}</h2>
        <p className={styles.sectionDesc}>{t('ministry.desc')}</p>

        <div className={styles.card}>
          <table className={styles.table} aria-label={t('ministry.tableLabel')}>
            <thead>
              <tr>
                <th>{t('ministry.colType')}</th>
                <th>{t('ministry.colMinistry')}</th>
                <th>{t('ministry.colAgency')}</th>
              </tr>
            </thead>
            <tbody>
              {MINISTRY_MAP.map((row) => (
                <tr key={row.type.ko}>
                  <td>{row.type[l]}</td>
                  <td>{row.ministry[l]}</td>
                  <td>{row.agency[l]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <blockquote className={styles.quote}>
            {t('ministry.quote')}
            <footer className={styles.quoteBy}>{t('ministry.quoteBy')}</footer>
          </blockquote>

          <p className={styles.footnote}>{t('ministry.footnote')}</p>
        </div>
      </section>
    </main>
  );
}
