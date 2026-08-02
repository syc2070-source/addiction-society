import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import {
  fetchIndicator,
  fetchIndicators,
  fetchPolicyDocuments,
  fetchRecoveryResources,
  fetchSourcesSummary,
  fetchTimeline,
  type Indicator,
  type Observation,
  type SummaryItem,
} from '@/lib/api';
import { MINISTRY_MAP } from '@/data/ministry-map';
import styles from './page.module.css';

/**
 * 홈 (F-1 + AS-UI-4).
 * 구성: 히어로 + 관측소 카드 → 핵심 숫자 → 부처 분산 지도 → 주목 지표 → 최근 관측 활동.
 * 서버 컴포넌트 — 모든 수치는 운영 API 실값(5분 재검증)이며, 실패·빈 값은 "수집 중"으로
 * 표시한다(가짜 데이터 금지 — 블루프린트 불변 원칙 1).
 */

/** 관측치에서 대표값 1건 고르기: 전체(qualifier='total') 중 가장 최근 기간. */
function latestObservation(observations: Observation[]): Observation | null {
  const pool = observations.filter(
    (o) => !o.qualifier || o.qualifier === 'total',
  );
  const rows = pool.length > 0 ? pool : observations;
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.period.localeCompare(a.period))[0];
}

/** 주목 지표 2개 = 관측치가 쌓인 지표 우선(개수 내림차순, 동수는 code 오름차순). */
function pickFeatured(indicators: Indicator[]): Indicator[] {
  return [...indicators]
    .filter((i) => (i.observationCount ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.observationCount ?? 0) - (a.observationCount ?? 0) ||
        a.code.localeCompare(b.code),
    )
    .slice(0, 2);
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);

  const t = await getTranslations();
  const tTimeline = await getTranslations('timelinePage');

  const l = locale as AppLocale;

  // 홈에 필요한 실값을 병렬 수집. 개별 실패는 null → 해당 칸만 "수집 중".
  const [summary, indicatorList, policy, recovery, timeline] =
    await Promise.all([
      fetchSourcesSummary(),
      fetchIndicators(),
      fetchPolicyDocuments({ page: 1 }),
      fetchRecoveryResources({ page: 1 }),
      fetchTimeline({ limit: 4 }),
    ]);

  const featuredMeta = pickFeatured(indicatorList?.data ?? []);
  const featuredDetails = await Promise.all(
    featuredMeta.map((i) => fetchIndicator(i.code)),
  );
  const featured: Array<{ indicator: Indicator; obs: Observation }> = [];
  for (const detail of featuredDetails) {
    if (!detail) continue;
    const obs = latestObservation(detail.observations);
    // 대표 관측치가 없으면(미수집·검수 대기) 카드를 만들지 않는다 — 빈 값 노출 금지.
    if (obs) featured.push({ indicator: detail.indicator, obs });
  }

  const stats: Array<{ href: string; label: string; value: number | null }> = [
    {
      href: '/sources',
      label: t('home.statSources'),
      value: summary?.total ?? null,
    },
    {
      href: '/indicators',
      label: t('home.statIndicators'),
      value: indicatorList?.total ?? null,
    },
    {
      href: '/policy',
      label: t('home.statPolicy'),
      value: policy?.total ?? null,
    },
    {
      href: '/recovery',
      label: t('home.statRecovery'),
      value: recovery?.total ?? null,
    },
  ];

  const indicatorName = (i: Indicator) =>
    l === 'en' && i.nameEn ? i.nameEn : i.nameKo;

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
        <span className={styles.obsLabel}>
          {/* /en은 labelEn 우선, 없으면 label (구버전 API 호환) */}
          {l === 'en' ? it.labelEn || it.label : it.label}
        </span>
      </div>
    ));
  };

  return (
    <main className={styles.main}>
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

      {/* 블록 1 — 핵심 숫자 한 줄 (4칸). 값은 각 목록 API의 total 실값. */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('home.statsTitle')}</h2>
        <div className={styles.statsRow}>
          {stats.map((s) => (
            <Link key={s.href} href={s.href} className={styles.statCell}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>
                {s.value === null ? (
                  <span className={styles.statPending}>
                    {t('common.collecting')}
                  </span>
                ) : (
                  t('home.statCount', { count: s.value })
                )}
              </span>
            </Link>
          ))}
        </div>
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

      {/* 블록 2 — 주목 지표 2개. 값·기간·원본 링크는 /api/indicators 실값. */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('home.featuredTitle')}</h2>
        {featured.length === 0 ? (
          <p className={styles.blockPending}>{t('common.collectingEmpty')}</p>
        ) : (
          <div className={styles.featuredRow}>
            {featured.map(({ indicator, obs }) => (
              <div key={indicator.id} className={styles.featuredCard}>
                <Link
                  href={`/indicators/${indicator.code}`}
                  className={styles.featuredName}
                >
                  {indicatorName(indicator)}
                </Link>
                <div className={styles.featuredValue}>
                  {obs.value}
                  {indicator.unit ? (
                    <span className={styles.featuredUnit}>{indicator.unit}</span>
                  ) : null}
                </div>
                <div className={styles.featuredMeta}>
                  <span>{obs.period}</span>
                  <a
                    href={obs.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.blockLink}
                  >
                    {t('common.viewOriginal')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className={styles.blockMore}>
          <Link href="/indicators" className={styles.blockLink}>
            {t('home.featuredMore')}
          </Link>
        </p>
      </section>

      {/* 블록 3 — 최근 관측 활동. GET /api/timeline?limit=4 (source_events 실값). */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('home.activityTitle')}</h2>
        {!timeline || timeline.data.length === 0 ? (
          <p className={styles.blockPending}>{t('common.collectingEmpty')}</p>
        ) : (
          <ul className={styles.activityList}>
            {timeline.data.map((e) => (
              <li key={e.id} className={styles.activityItem}>
                <span className={styles.activityDate}>
                  {e.detectedAt.slice(0, 10)}
                </span>
                <span className={styles.activityOrg}>
                  {l === 'en' ? e.org || e.orgKo : e.orgKo || e.org}
                </span>
                <span className={styles.activityEvent}>
                  {tTimeline(`event.${e.eventType}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.blockMore}>
          <Link href="/timeline" className={styles.blockLink}>
            {t('home.activityMore')}
          </Link>
        </p>
      </section>
    </main>
  );
}
