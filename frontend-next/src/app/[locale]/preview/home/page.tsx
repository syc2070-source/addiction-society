import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import {
  fetchCalendar,
  fetchIndicator,
  fetchIndicators,
  fetchPolicyDocuments,
  fetchRecoveryAll,
  fetchSources,
  fetchSourcesSummary,
  fetchTimeline,
  type Indicator,
  type Observation,
  type Source,
} from '@/lib/api';
import {
  doiUrl,
  evidenceTitle,
  evidenceTopics,
  loadEvidenceMap,
} from '@/lib/evidenceMap';
import { MINISTRY_MAP } from '@/data/ministry-map';
import { pickTodaysNumber } from '@/lib/todayNumber';
import {
  broadcastLineLabels,
  cityLabel,
  orgLabel,
  unitLabel,
} from '@/lib/enLabels';
import {
  ADDICTION_TYPES,
  TYPE_REPRESENTATIVE,
  indicatorType,
  sourceType,
  titleType,
  typeColorVar,
  type AddictionType,
} from '@/lib/addictionTypes';
import { changeFromPrevious, threeFrom } from '@/lib/homeV2';
import { paperLine } from '@/lib/paperLine';
import TenYearChart, { type Panel } from './TenYearChart';
import styles from './v2.module.css';

/**
 * 홈 v2 「한 그림 먼저」 미리보기 (SOC-R19 ■1~■5) — /preview/home · /en/preview/home.
 *
 * 지금 홈(/)은 그대로 두고 따로 선 길이다. 검색 색인 0(noindex · sitemap 에 없음).
 * 이야기 순서: ① 그림·큰 수 셋 → ② 흩어진 대응 → ③ 근거 → ④ 연대기(손님 사건만) → ⑤ 회복자원 →
 * ⑥ 다음 발표(달력 + 관측소 「다음 발표 예정」) → ⑦ 운영 수 한 줄.
 * 운영 로그(변경 감지 · 차단 · 수동 확인 필요)는 여기 없다 — /admin/activity 로 옮김(공개 API 는 그대로).
 * 수는 모두 운영 API · Statory 묶음의 저장된 값 그대로. 화면용으로 만드는 것은 「앞 조사 대비 ±」와
 * 그림의 지수 토글뿐(lib/homeV2). 모델 호출 0.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homeV2' });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    alternates: { canonical: locale === 'ko' ? '/' : `/${locale}` },
  };
}

const isTotal = (o: Observation) => !o.qualifier || o.qualifier === 'total';

/** 전체값 시계열(기간 오름차순 · 기간이 겹치면 하나) — 지금 홈과 같은 규칙. */
function totalSeries(observations: Observation[]): Observation[] {
  const byPeriod = new Map<string, Observation>();
  for (const o of observations.filter(isTotal)) byPeriod.set(o.period, o);
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function currentMonthKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
}

export default async function HomeV2Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations();
  const tv = await getTranslations('homeV2');
  const fmt = (n: number) => n.toLocaleString(l);

  const [
    summary,
    indicatorList,
    policy,
    timeline,
    calendar,
    sourceList,
    recoveryAll,
    maps,
  ] = await Promise.all([
    fetchSourcesSummary(),
    fetchIndicators(),
    fetchPolicyDocuments({ page: 1 }),
    fetchTimeline({ limit: 50 }),
    fetchCalendar(),
    fetchSources({}),
    fetchRecoveryAll(),
    Promise.all(evidenceTopics().map((tp) => loadEvidenceMap(tp))),
  ]);

  const indicators = indicatorList?.data ?? [];
  const seriesMeta = indicators.filter((i) => (i.observationCount ?? 0) >= 2);
  const repCodes = Object.values(TYPE_REPRESENTATIVE);
  const detailCodes = [
    ...new Set([...seriesMeta.map((i) => i.code), ...repCodes]),
  ].filter((c) => indicators.some((i) => i.code === c));
  const details = new Map(
    (await Promise.all(detailCodes.map((c) => fetchIndicator(c))))
      .filter((d) => d !== null)
      .map((d) => [d.indicator.code, d]),
  );

  const indicatorName = (i: Indicator) =>
    l === 'en' && i.nameEn ? i.nameEn : i.nameKo;
  const typeLabel = (type: AddictionType) => t(`addictionType.${type}`);
  const unitOf = (unit: string | null) => {
    const u = unitLabel(unit, l);
    return !u ? '' : u === '%' ? '%' : ` ${u}`;
  };
  const sourceById = new Map<string, Source>(
    (sourceList?.data ?? []).map((s) => [s.id, s]),
  );

  // ① 그림 — 유형별 대표 지표(값이 있는 것만 · 빈 그림 0)
  const panels: Panel[] = [];
  for (const type of ADDICTION_TYPES) {
    const d = details.get(TYPE_REPRESENTATIVE[type]);
    if (!d) continue;
    const series = totalSeries(d.observations);
    if (series.length < 2) continue;
    panels.push({
      type,
      typeLabel: typeLabel(type),
      code: d.indicator.code,
      name: indicatorName(d.indicator),
      unit: d.indicator.unit ?? '',
      series: series.map((o) => ({ period: o.period, value: o.value })),
      breakYears: d.indicator.breakYears ?? null,
      href: `/indicators/${d.indicator.code}`,
    });
  }

  // ① 큰 수 셋 — 오늘의 숫자(날마다 순환 · 지금 홈과 같은 고르기)에서 이어지는 셋
  const candidates = seriesMeta
    .map((m) => details.get(m.code))
    .filter((d) => d !== undefined)
    .map((d) => {
      const series = totalSeries(d.observations);
      return { code: d.indicator.code, points: series.length, indicator: d.indicator, series };
    });
  const todayPick = pickTodaysNumber(candidates, new Date());
  const pool = candidates
    .filter((c) => c.points >= 2)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const tiles = todayPick ? threeFrom(pool, todayPick.index) : [];

  // ③ 근거 지도
  const topics = evidenceTopics();

  // ④ 연대기 최근 다섯 — 손님 사건만(발간 감지 · 방송). 변경 감지 · 차단 · 수동 확인 · 이월은 넣지 않는다.
  type GuestEvent = {
    key: string;
    date: string;
    type: AddictionType | null;
    kind: string;
    org: string;
    title: string;
    url: string | null;
  };
  const guestEvents: GuestEvent[] = [
    ...(timeline?.data ?? [])
      .filter((e) => e.eventType === 'published' && !e.notRelease)
      .map((e) => ({
        key: `e${e.id}`,
        date: e.detectedAt.slice(0, 10),
        type: sourceType(sourceById.get(e.sourceId) ?? { id: e.sourceId }),
        kind: tv('eventPublished'),
        org: orgLabel({ id: e.sourceId, org: e.org, orgKo: e.orgKo }, l),
        title:
          (l === 'en' ? e.titleEn || e.titleKo : e.titleKo || e.titleEn) ||
          e.sourceId,
        url: e.url,
      })),
    ...(timeline?.broadcasts ?? []).map((b) => {
      const line = broadcastLineLabels(b, l);
      return {
        key: `b${b.id}`,
        date: (b.publishedAt ?? '').slice(0, 10),
        type: titleType(b.title),
        kind: tv('eventBroadcast'),
        org: line.org,
        title: line.title,
        url: b.url,
      };
    }),
  ]
    .filter((e) => e.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // ⑤ 회복자원 — 지역별 곳 수(저장된 city 그대로 센 수 · 지도 대신 가로 막대)
  const resources = recoveryAll?.data ?? [];
  const byCity = new Map<string, number>();
  for (const r of resources) {
    if (r.city) byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  }
  const cityRows = [...byCity.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'),
  );
  const cityMax = Math.max(1, ...cityRows.map(([, n]) => n));
  const recoveryAction =
    l === routing.defaultLocale ? '/recovery' : `/${l}/recovery`;

  // ⑥ 다음 발표 — 발표 달력(이번 달) + 관측소 「다음 발표 예정」을 한 목록으로(같은 출처는 한 번)
  const month = currentMonthKst();
  const nextRows: Array<{
    key: string;
    ym: string;
    title: string;
    org: string;
    url: string | null;
  }> = [];
  const seen = new Set<string>();
  for (const s of (calendar ?? []).filter((s) =>
    String(s.nextExpectedAt ?? '').startsWith(month),
  )) {
    seen.add(s.id);
    nextRows.push({
      key: s.id,
      ym: String(s.nextExpectedAt).slice(0, 7),
      title: l === 'en' && s.titleEn ? s.titleEn : s.titleKo,
      org: orgLabel(s, l),
      url: s.url,
    });
  }
  for (const it of summary?.upcoming ?? []) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    const src = sourceById.get(it.id);
    nextRows.push({
      key: it.id,
      ym: it.date.slice(0, 7),
      title: l === 'en' ? it.labelEn || it.label : it.label,
      org: src ? orgLabel(src, l) : l === 'en' ? '' : it.org,
      url: src?.url ?? null,
    });
  }
  nextRows.sort((a, b) => a.ym.localeCompare(b.ym));

  const rich = {
    hl: (chunks: React.ReactNode) => <b>{chunks}</b>,
    b: (chunks: React.ReactNode) => <b>{chunks}</b>,
  };

  return (
    <main className={styles.main}>
      {/* ① 한 문장 + 그림 + 큰 수 셋 */}
      <section>
        <h1 className={styles.lead}>
          {t.rich('hero.line1', rich)} {t.rich('hero.line2', rich)}
        </h1>

        <div className={styles.chartHead}>
          <div className={styles.kicker}>{tv('chartKicker')}</div>
          <h2 className={styles.title}>{tv('chartTitle')}</h2>
          <p className={styles.desc}>{tv('chartDesc')}</p>
        </div>
        {panels.length === 0 ? (
          <p className={styles.empty}>{t('common.unavailable')}</p>
        ) : (
          <TenYearChart
            panels={panels}
            labels={{
              scaleRaw: tv('scaleRaw'),
              scaleIndex: tv('scaleIndex'),
              scaleIndexNote: tv('scaleIndexNote'),
              tableView: tv('tableView'),
              colType: tv('colType'),
              colIndicator: tv('colIndicator'),
              colValues: tv('colValues'),
              points: (p) =>
                tv('pointsNote', {
                  points: p.series.length,
                  from: p.series[0].period,
                  to: p.series[p.series.length - 1].period,
                }),
            }}
            breakNote={(years) =>
              t('common.designChange', { years: years.join(' · ') })
            }
            unitText={unitOf}
          />
        )}

        {tiles.length > 0 && (
          <div className={styles.tiles}>
            {tiles.map((c) => {
              const last = c.series[c.series.length - 1];
              const type = indicatorType(c.code);
              const change = changeFromPrevious(
                c.series.map((o) => ({ period: o.period, value: o.value })),
                c.indicator.breakYears,
              );
              const src = c.indicator.sourceId
                ? sourceById.get(c.indicator.sourceId)
                : undefined;
              const pointUnit =
                c.indicator.unit === '%' ? tv('pointUnit') : unitOf(c.indicator.unit);
              return (
                <div key={c.code} className={styles.tile}>
                  <div className={styles.tileHead}>
                    <span
                      className={styles.typeDot}
                      style={{ background: typeColorVar(type) }}
                      aria-hidden
                    />
                    {type && <span>{typeLabel(type)}</span>}
                    <Link href={`/indicators/${c.code}`} className={styles.link}>
                      {indicatorName(c.indicator)}
                    </Link>
                  </div>
                  <div className={styles.tileValue}>
                    {Number(last.value) >= 1000
                      ? fmt(Number(last.value))
                      : last.value}
                    {c.indicator.unit ? (
                      <span className={styles.tileUnit}>
                        {unitLabel(c.indicator.unit, l)}
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.tileChange}>
                    {change.kind === 'delta'
                      ? tv('change', {
                          from: change.fromPeriod,
                          delta: `${change.text}${pointUnit}`,
                        })
                      : change.kind === 'break'
                        ? tv('changeBreak', { from: change.fromPeriod })
                        : tv('changeNone')}
                  </p>
                  <div className={styles.tileMeta}>
                    <span>{last.period}</span>
                    {src && <span>{orgLabel(src, l)}</span>}
                    <a
                      href={last.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.link}
                    >
                      {t('common.viewOriginal')}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {todayPick && todayPick.total > 3 && (
          <p className={styles.tileOthers}>
            <Link href="/indicators" className={styles.link}>
              {tv('tileOthers', { total: todayPick.total })}
            </Link>
          </p>
        )}
        <p className={styles.trust}>{tv('trust')}</p>
      </section>

      {/* ② 흩어진 대응 — 지금 표·인용 그대로 */}
      <section className={styles.band}>
        <div className={styles.kicker}>{t('ministry.kicker')}</div>
        <h2 className={styles.title}>{t('ministry.title')}</h2>
        <p className={styles.desc}>{t('ministry.desc')}</p>
        <div className={styles.tableWrap}>
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
        </div>
        <blockquote className={styles.quote}>
          {t('ministry.quote')}
          <footer className={styles.quoteBy}>{t('ministry.quoteBy')}</footer>
        </blockquote>
        <p className={styles.footnote}>{t('ministry.footnote')}</p>
      </section>

      {/* ③ 근거 지도 — 큰 수가 머리 · 논문은 접힘 */}
      {topics.length > 0 && (
        <section className={styles.section}>
          <div className={styles.kicker}>{tv('evidenceKicker')}</div>
          <h2 className={styles.title}>{tv('evidenceTitle')}</h2>
          <p className={styles.desc}>{t('home.mapDesc')}</p>
          <div className={styles.evidenceGrid}>
            {topics.map((tp, i) => {
              const m = maps[i];
              if (!m) {
                return (
                  <div key={tp} className={styles.evidenceCard}>
                    <h3 className={styles.evidenceTopic}>{tp}</h3>
                    <p className={styles.empty}>{t('home.mapPending')}</p>
                  </div>
                );
              }
              const type = titleType(m.titleEn ?? m.topic);
              const instrumentNames = m.instruments.map(([n]) => n);
              const papers = [
                ...m.corePapers.slice(0, 3).map((p) => ({ p, kind: t('home.mapCore') })),
                ...m.reviews.slice(0, 2).map((p) => ({ p, kind: t('home.mapReviews') })),
              ];
              return (
                <div key={tp} className={styles.evidenceCard}>
                  {type && (
                    <span className={styles.typeTag}>
                      <span
                        className={styles.typeDot}
                        style={{ background: typeColorVar(type) }}
                        aria-hidden
                      />
                      {typeLabel(type)}
                    </span>
                  )}
                  <h3 className={styles.evidenceTopic}>{evidenceTitle(m, l)}</h3>
                  <p className={styles.evidenceHead}>
                    {m.openAccess !== null
                      ? tv('evidenceHead', {
                          studies: fmt(m.studies),
                          open: fmt(m.openAccess),
                        })
                      : t('home.mapStudies', { count: fmt(m.studies) })}
                  </p>
                  {m.trend && (
                    <p className={styles.evidenceSub}>
                      {t('home.mapTrend', {
                        last: fmt(m.trend.lastFive),
                        before: fmt(m.trend.fiveBefore),
                      })}
                    </p>
                  )}
                  {m.instruments.length > 0 && (
                    <div className={styles.chips} aria-label={t('home.mapInstruments')}>
                      {m.instruments.slice(0, 4).map(([name, n]) => (
                        <span key={name} className={styles.chip}>
                          {name} {fmt(n)}
                        </span>
                      ))}
                    </div>
                  )}
                  {papers.length > 0 && (
                    <details className={styles.papers}>
                      <summary>{tv('papersOpen')}</summary>
                      <ol className={styles.paperList}>
                        {papers.map(({ p, kind }) => {
                          const line =
                            l === 'ko' ? paperLine(p.title, instrumentNames) : null;
                          return (
                            <li key={`${kind}${p.doi ?? p.title}`}>
                              <span className={styles.paperKind}>{kind}</span>
                              {p.doi ? (
                                <a
                                  href={doiUrl(p.doi)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.link}
                                  lang="en"
                                >
                                  {p.title}
                                </a>
                              ) : (
                                <span lang="en">{p.title}</span>
                              )}
                              {line && (
                                <span className={styles.paperLine}>
                                  {[
                                    line.topics.length
                                      ? `주제 ${line.topics.join('·')}`
                                      : '',
                                    line.instruments.length
                                      ? `척도 ${line.instruments.join('·')}`
                                      : '',
                                    line.samples.length
                                      ? `표본 ${line.samples.join('·')}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  )}
                  <p className={styles.more}>
                    <Link href={`/evidence-map/${tp}`} className={styles.link}>
                      {t('home.mapMore')}
                    </Link>
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ④ 연대기 최근 다섯 — 손님 사건만 */}
      <section className={styles.section}>
        <div className={styles.kicker}>{tv('timelineKicker')}</div>
        <h2 className={styles.title}>{tv('timelineTitle')}</h2>
        {guestEvents.length === 0 ? (
          <p className={styles.empty}>
            {timeline === null ? t('common.unavailable') : tv('timelineEmpty')}
          </p>
        ) : (
          <ul className={styles.events}>
            {guestEvents.map((e) => (
              <li key={e.key} className={styles.event}>
                <span className={styles.eventDate}>{e.date}</span>
                <span
                  className={styles.eventDot}
                  style={{ background: typeColorVar(e.type) }}
                  aria-hidden
                />
                <span className={styles.eventBody}>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.link}
                    >
                      {e.title}
                    </a>
                  ) : (
                    e.title
                  )}
                  <span className={styles.eventMeta}>
                    {[e.kind, e.type ? typeLabel(e.type) : '', e.org]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.more}>
          <Link href="/timeline" className={styles.link}>
            {tv('timelineMore')}
          </Link>
        </p>
      </section>

      {/* ⑤ 회복자원 — 곳 수 · 지역별 가로 막대 · 찾기 */}
      <section className={styles.band}>
        <div className={styles.kicker}>{tv('recoveryKicker')}</div>
        <h2 className={styles.title}>{tv('recoveryTitle')}</h2>
        {recoveryAll === null ? (
          <p className={styles.empty}>{t('common.unavailable')}</p>
        ) : (
          <>
            <p className={styles.recoveryHead}>
              {t('home.recoveryCount', {
                total: fmt(recoveryAll.total),
                regions: fmt(cityRows.length),
              })}
            </p>
            <ul className={styles.bars} aria-label={tv('recoveryBars')}>
              {cityRows.map(([city, n]) => (
                <li key={city} className={styles.bar}>
                  <span className={styles.barLabel}>{cityLabel(city, l)}</span>
                  <span className={styles.barTrack} aria-hidden>
                    <span
                      className={styles.barFill}
                      style={{ width: `${(n / cityMax) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barValue}>{fmt(n)}</span>
                </li>
              ))}
            </ul>
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

      {/* ⑥ 다음 발표 — 발표 달력 + 관측소 「다음 발표 예정」 하나로 (남색 강조는 여기 하나) */}
      <section className={styles.next}>
        <div className={styles.kicker}>{tv('nextKicker')}</div>
        <h2 className={styles.title}>{tv('nextTitle')}</h2>
        {calendar === null && summary === null ? (
          <p className={styles.empty}>{t('common.unavailable')}</p>
        ) : nextRows.length === 0 ? (
          <p className={styles.empty}>{tv('nextEmpty')}</p>
        ) : (
          <ul className={styles.nextList}>
            {nextRows.map((r) => (
              <li key={r.key} className={styles.nextItem}>
                <span className={styles.nextDate}>{r.ym}</span>
                <span className={styles.nextBody}>
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.nextLink}
                    >
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                  {r.org && <span className={styles.nextOrg}>{r.org}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.nextMore}>
          <Link href="/calendar">{t('home.monthMore')}</Link>
          <Link href="/timeline">{tv('nextUpdatesMore')}</Link>
        </p>
      </section>

      {/* ⑦ 운영 수 — 바닥 한 줄(작게) */}
      <p className={styles.statsLine}>
        {tv('footerStats', {
          sources: summary ? fmt(summary.total) : '—',
          indicators: indicatorList ? fmt(indicatorList.total) : '—',
          policy: policy ? fmt(policy.total) : '—',
          recovery: recoveryAll ? fmt(recoveryAll.total) : '—',
        })}
      </p>
    </main>
  );
}
