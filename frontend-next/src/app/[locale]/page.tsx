import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import {
  fetchCalendar,
  fetchIndicator,
  fetchIndicators,
  fetchPolicyDocuments,
  fetchRecoveryAll,
  fetchRecoveryResources,
  fetchSources,
  fetchSourcesSummary,
  fetchTimeline,
  type Indicator,
  type Observation,
  type Source,
  type SummaryItem,
} from '@/lib/api';
import {
  doiUrl,
  evidenceTitle,
  evidenceTopics,
  loadEvidenceMap,
} from '@/lib/evidenceMap';
import { MINISTRY_MAP } from '@/data/ministry-map';
import { pickTodaysNumber } from '@/lib/todayNumber';
import { orgLabel, unitLabel } from '@/lib/enLabels';
import { seriesBreakYears, splitAtBreaks } from '@/lib/seriesBreaks';
import styles from './page.module.css';

/**
 * 홈 (F-1 + AS-UI-4 → SOC-R2 첫 화면 재정의).
 * 첫 화면 = 슬로건 한 줄 + 설명 한 문장 + 넷(오늘의 숫자 · 근거 지도 · 이번 달 발표 ·
 * 회복자원) + 「지금까지 모은 것」 네 칸. 관측소 블록은 둘째 화면.
 * 서버 컴포넌트 — 모든 수치는 운영 API 실값(5분 재검증) 또는 Statory 묶음 JSON 의 센
 * 값이며, 실패·빈 값은 "수집 중"·상자 숨김으로 처리한다(가짜 데이터 금지 — 원칙 1).
 */

const isTotal = (o: Observation) => !o.qualifier || o.qualifier === 'total';

/** 관측치에서 대표값 1건 고르기: 전체(qualifier='total') 중 가장 최근 기간. */
function latestObservation(observations: Observation[]): Observation | null {
  const pool = observations.filter(isTotal);
  const rows = pool.length > 0 ? pool : observations;
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.period.localeCompare(a.period))[0];
}

/** 전체값 시계열(기간 오름차순). 기간이 겹치면 하나만. */
function totalSeries(observations: Observation[]): Observation[] {
  const byPeriod = new Map<string, Observation>();
  for (const o of observations.filter(isTotal)) byPeriod.set(o.period, o);
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
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

/**
 * 오늘의 숫자 작은 추세선 — 2점 이상일 때만.
 * SOC-R6 ■2: 조사 설계 변경 해(breakYears)에서 선을 끊고 토막 사이를 점선으로 잇는다.
 */
function MiniTrend({
  series,
  breakYears,
}: {
  series: Observation[];
  breakYears?: number[] | null;
}) {
  const W = 220;
  const H = 48;
  const P = 4;
  const vals = series.map((o) => Number(o.value));
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (series.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const segs = splitAtBreaks(
    series.map((o) => o.period),
    breakYears,
  );
  const pt = (i: number) => `${x(i)},${y(vals[i])}`;
  return (
    <svg
      className={styles.todaySpark}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={series.map((o) => `${o.period} ${o.value}`).join(', ')}
    >
      {segs.slice(1).map((seg, k) => (
        <polyline
          key={`b${seg[0]}`}
          className={styles.todaySparkBreak}
          points={`${pt(segs[k][segs[k].length - 1])} ${pt(seg[0])}`}
        />
      ))}
      {segs.map((seg) =>
        seg.length > 1 ? (
          <polyline
            key={`s${seg[0]}`}
            className={styles.todaySparkLine}
            points={seg.map(pt).join(' ')}
          />
        ) : segs.length > 1 ? (
          <circle
            key={`s${seg[0]}`}
            className={styles.todaySparkDot}
            cx={x(seg[0])}
            cy={y(vals[seg[0]])}
            r={2.5}
          />
        ) : null,
      )}
    </svg>
  );
}

/** 지금 달(KST) 'YYYY-MM'. */
function currentMonthKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);

  const t = await getTranslations();
  const tTimeline = await getTranslations('timelinePage');

  const l = locale as AppLocale;
  const fmt = (n: number) => n.toLocaleString(l);

  // 홈에 필요한 실값을 병렬 수집. 개별 실패는 null → 해당 칸만 "수집 중"/숨김.
  const [
    summary,
    indicatorList,
    policy,
    recovery,
    timeline,
    calendar,
    sourceList,
    recoveryAll,
    maps,
  ] = await Promise.all([
    fetchSourcesSummary(),
    fetchIndicators(),
    fetchPolicyDocuments({ page: 1 }),
    fetchRecoveryResources({ page: 1 }),
    fetchTimeline({ limit: 4 }),
    fetchCalendar(),
    fetchSources({}),
    fetchRecoveryAll(),
    Promise.all(evidenceTopics().map((tp) => loadEvidenceMap(tp))),
  ]);

  // 주목 지표 + 오늘의 숫자 후보(관측치 2개 이상) 상세를 한 번에 읽는다.
  const indicators = indicatorList?.data ?? [];
  const featuredMeta = pickFeatured(indicators);
  const seriesMeta = indicators.filter((i) => (i.observationCount ?? 0) >= 2);
  const detailCodes = [
    ...new Set([...featuredMeta, ...seriesMeta].map((i) => i.code)),
  ];
  const details = new Map(
    (await Promise.all(detailCodes.map((c) => fetchIndicator(c))))
      .filter((d) => d !== null)
      .map((d) => [d.indicator.code, d]),
  );

  const featured: Array<{ indicator: Indicator; obs: Observation }> = [];
  for (const meta of featuredMeta) {
    const detail = details.get(meta.code);
    if (!detail) continue;
    const obs = latestObservation(detail.observations);
    // 대표 관측치가 없으면(미수집·검수 대기) 카드를 만들지 않는다 — 빈 값 노출 금지.
    if (obs) featured.push({ indicator: detail.indicator, obs });
  }

  // ⓐ 오늘의 숫자 — 전체값 시계열이 2점 이상인 지표 전부를 후보로, 오늘(KST) 날짜로 하나씩
  // 돌아가며(SOC-R5 ■4 · lib/todayNumber). 같은 날엔 같은 지표. 후보가 없으면 숨김.
  const todayPick = pickTodaysNumber(
    seriesMeta
      .map((m) => details.get(m.code))
      .filter((d) => d !== undefined)
      .map((d) => {
        const series = totalSeries(d.observations);
        return { code: d.indicator.code, points: series.length, indicator: d.indicator, series };
      }),
    new Date(),
  );
  const today = todayPick?.pick;
  const sourceById = new Map<string, Source>(
    (sourceList?.data ?? []).map((s) => [s.id, s]),
  );
  const todaySource = today?.indicator.sourceId
    ? sourceById.get(today.indicator.sourceId)
    : undefined;
  const todayLatest = today?.series[today.series.length - 1];
  // SOC-R6 ■2: 이 시계열 안에서 실제로 선을 끊는 조사 설계 변경 해(꼬리 한 줄)
  const todayBreaks = today
    ? seriesBreakYears(
        today.series.map((o) => o.period),
        today.indicator.breakYears,
      )
    : [];

  // ⓒ 이번 달 발표 예정(달력 데이터 = next_expected_at 이 이번 달).
  // SOC-R3 ■4: 예정은 월 단위 — 이번 달 것은 그 달 말일까지 「지나지 않은」 예정이다.
  // 지난 달 이전 것은 여기 오지 않고 달력 페이지 「지난 예정 · 미확인」 줄에만 보인다.
  const month = currentMonthKst();
  const thisMonth = (calendar ?? []).filter((s) =>
    String(s.nextExpectedAt ?? '').startsWith(month),
  );

  // ⓓ 회복자원 — 유형별 수 · 지역(시도) 수.
  const resources = recoveryAll?.data ?? [];
  const byType = new Map<string, number>();
  for (const r of resources) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  const regions = new Set(resources.map((r) => r.city).filter(Boolean)).size;
  const typeLabel = (type: string) =>
    t.has(`home.recoveryType.${type}`) ? t(`home.recoveryType.${type}`) : type;
  const recoveryAction = l === routing.defaultLocale ? '/recovery' : `/${l}/recovery`;

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
  const sourceTitle = (s: Source) =>
    l === 'en' && s.titleEn ? s.titleEn : s.titleKo;
  const sourceOrg = (s: Source) => orgLabel(s, l);

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

  const topics = evidenceTopics();

  return (
    <main className={styles.main}>
      {/* 첫 화면 — 슬로건 한 줄 + 설명 한 문장 */}
      <section className={styles.firstHero}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          <span className={styles.badgeLabel}>{t('hero.badgeLabel')}</span>
          <span className={styles.badgeDesc}>{t('hero.badgeDesc')}</span>
        </div>
        <h1 className={styles.heroTitle}>
          {t.rich('hero.line1', rich)} {t.rich('hero.line2', rich)}
        </h1>
        <p className={styles.heroLead}>{t('home.lead')}</p>
      </section>

      {/* 첫 화면 넷 */}
      <div className={styles.four}>
        {/* ⓐ 오늘의 숫자 — 시계열 있는 지표가 없으면 상자 자체를 숨긴다 */}
        {today && todayLatest && (
          <section className={styles.box}>
            <div className={styles.boxKicker}>{t('home.todayTitle')}</div>
            <h2 className={styles.boxTitle}>{indicatorName(today.indicator)}</h2>
            <div className={styles.todayValue}>
              {/* SOC-R4: 인원 같은 큰 수는 자릿수 구분(23403 → 23,403) · 비율은 원문 그대로 */}
              {Number(todayLatest.value) >= 1000
                ? fmt(Number(todayLatest.value))
                : todayLatest.value}
              {today.indicator.unit ? (
                <span className={styles.featuredUnit}>
                  {unitLabel(today.indicator.unit, l)}
                </span>
              ) : null}
            </div>
            <div className={styles.featuredMeta}>
              <span>{todayLatest.period}</span>
              {todaySource && (
                <span>
                  {t('home.todaySource')} {sourceOrg(todaySource)}
                </span>
              )}
              <a
                href={todayLatest.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.blockLink}
              >
                {t('common.viewOriginal')}
              </a>
            </div>
            <MiniTrend
              series={today.series}
              breakYears={today.indicator.breakYears}
            />
            {todayBreaks.length > 0 && (
              <p className={styles.todayBreakNote}>
                {t('common.designChange', { years: todayBreaks.join(' · ') })}
              </p>
            )}
            <Link
              href={`/indicators/${today.indicator.code}`}
              className={styles.blockLink}
            >
              {t('home.todayMore')}
            </Link>
            {/* SOC-R5 ■4: 날마다 바뀐다 — 나머지 후보는 지표 목록에서 */}
            {todayPick && todayPick.total > 1 && (
              <Link href="/indicators" className={styles.blockLink}>
                {t('home.todayOthers', { total: todayPick.total })}
              </Link>
            )}
          </section>
        )}

        {/* ⓑ 근거 지도 — Statory 묶음 JSON 의 센 값 그대로 */}
        {topics.length > 0 && (
          <section className={`${styles.box} ${styles.fourWide}`}>
            <div className={styles.boxKicker}>{t('evidenceMap.title')}</div>
            <h2 className={styles.boxTitle}>{t('home.mapTitle')}</h2>
            <p className={styles.boxDesc}>{t('home.mapDesc')}</p>
            <div className={styles.mapCards}>
              {topics.map((tp, i) => {
                const m = maps[i];
                if (!m) {
                  return (
                    <div key={tp} className={styles.mapCard}>
                      <h3 className={styles.mapTopic}>{tp}</h3>
                      <p className={styles.blockPending}>
                        {t('home.mapPending')}
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={tp} className={styles.mapCard}>
                    <h3 className={styles.mapTopic}>{evidenceTitle(m, l)}</h3>
                    <div className={styles.mapNumbers}>
                      <b>{t('home.mapStudies', { count: fmt(m.studies) })}</b>
                      {m.trend && (
                        <span>
                          {t('home.mapTrend', {
                            last: fmt(m.trend.lastFive),
                            before: fmt(m.trend.fiveBefore),
                          })}
                        </span>
                      )}
                      {m.openAccess !== null && (
                        <span>
                          {t('home.mapOpen', {
                            open: fmt(m.openAccess),
                            total: fmt(m.studies),
                          })}
                        </span>
                      )}
                    </div>
                    {m.instruments.length > 0 && (
                      <>
                        <div className={styles.mapLabel}>
                          {t('home.mapInstruments')}
                        </div>
                        <div className={styles.chips}>
                          {m.instruments.slice(0, 3).map(([name, n]) => (
                            <span key={name} className={styles.chip}>
                              {name} {fmt(n)}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                    {m.corePapers.length > 0 && (
                      <>
                        <div className={styles.mapLabel}>{t('home.mapCore')}</div>
                        <ol className={styles.mapList}>
                          {m.corePapers.slice(0, 3).map((p) => (
                            <li key={p.doi ?? p.title}>
                              {p.doi ? (
                                <a
                                  href={doiUrl(p.doi)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.blockLink}
                                >
                                  {p.title}
                                </a>
                              ) : (
                                p.title
                              )}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                    {m.reviews.length > 0 && (
                      <>
                        <div className={styles.mapLabel}>
                          {t('home.mapReviews')}
                        </div>
                        <ol className={styles.mapList}>
                          {m.reviews.slice(0, 2).map((p) => (
                            <li key={p.doi ?? p.title}>
                              {p.doi ? (
                                <a
                                  href={doiUrl(p.doi)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.blockLink}
                                >
                                  {p.title}
                                </a>
                              ) : (
                                p.title
                              )}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                    <p className={styles.blockMore}>
                      <Link
                        href={`/evidence-map/${tp}`}
                        className={styles.blockLink}
                      >
                        {t('home.mapMore')}
                      </Link>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ⓒ 이번 달 발표 예정 — GET /api/sources/calendar */}
        <section className={styles.box}>
          <div className={styles.boxKicker}>{t('nav.calendar')}</div>
          <h2 className={styles.boxTitle}>{t('home.monthTitle')}</h2>
          {calendar === null ? (
            <p className={styles.blockPending}>{t('common.unavailable')}</p>
          ) : thisMonth.length === 0 ? (
            <p className={styles.blockPending}>{t('home.monthEmpty')}</p>
          ) : (
            <ul className={styles.monthList}>
              {thisMonth.map((s) => (
                <li key={s.id} className={styles.monthItem}>
                  <span className={styles.monthDate}>
                    {String(s.nextExpectedAt).slice(0, 7)}
                  </span>
                  <span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.blockLink}
                    >
                      {sourceTitle(s)}
                    </a>{' '}
                    <span className={styles.activityEvent}>{sourceOrg(s)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.blockMore}>
            <Link href="/calendar" className={styles.blockLink}>
              {t('home.monthMore')}
            </Link>
          </p>
        </section>

        {/* ⓓ 회복자원 — 유형·지역 수 + 찾기 */}
        <section className={styles.box}>
          <div className={styles.boxKicker}>{t('nav.recovery')}</div>
          <h2 className={styles.boxTitle}>{t('home.recoveryTitle')}</h2>
          {recoveryAll === null ? (
            <p className={styles.blockPending}>{t('common.unavailable')}</p>
          ) : (
            <>
              <p className={styles.recoveryBig}>
                {t('home.recoveryCount', {
                  total: fmt(recoveryAll.total),
                  regions: fmt(regions),
                })}
              </p>
              <div className={styles.chips}>
                {[...byType.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, n]) => (
                    <span key={type} className={styles.chip}>
                      {typeLabel(type)} {fmt(n)}
                    </span>
                  ))}
              </div>
            </>
          )}
          <form method="get" action={recoveryAction} className={styles.recoveryForm}>
            <input
              type="text"
              name="search"
              className="search-input"
              placeholder={t('home.recoverySearch')}
              aria-label={t('home.recoverySearch')}
            />
            <button type="submit" className="btn-submit">
              {t('common.searchButton')}
            </button>
          </form>
        </section>
      </div>

      {/* 「지금까지 모은 것」 — 핵심 숫자 4칸. 값은 각 목록 API의 total 실값. */}
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

      {/* 둘째 화면 — 관측소 카드 (GET /api/sources/summary) */}
      <section className={styles.section}>
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

      {/* 주목 지표 2개. 값·기간·원본 링크는 /api/indicators 실값. */}
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
                    <span className={styles.featuredUnit}>
                      {unitLabel(indicator.unit, l)}
                    </span>
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

      {/* 최근 관측 활동. GET /api/timeline?limit=4 (source_events 실값). */}
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
                  {orgLabel({ id: e.sourceId, org: e.org, orgKo: e.orgKo }, l)}
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
