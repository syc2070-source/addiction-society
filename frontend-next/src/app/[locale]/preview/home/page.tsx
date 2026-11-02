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
  NOT_ADDICTION_INDICATORS,
  TYPE_REPRESENTATIVE,
  indicatorType,
  sourceType,
  titleType,
  typeColorVar,
  typeColorVarDark,
  type AddictionType,
} from '@/lib/addictionTypes';
import { seriesBreakYears } from '@/lib/seriesBreaks';
import { changeFromPrevious, threeFrom } from '@/lib/homeV2';
import { pickHero, ratioText } from '@/lib/homeV3';
import { loadStatoryExport } from '@/lib/statoryEvidence';
import { paperLine } from '@/lib/paperLine';
import HeroBoard, { type SeriesPanel } from './HeroBoard';
import StatorySection from './StatorySection';
import { serifKr } from './serifFont';
import styles from './v2.module.css';
import d from './v3.module.css';

/**
 * 홈 v3 미리보기 · 견본 A (SOC-R20) — /preview/home · /en/preview/home.
 * (R19 의 v2 「한 그림 먼저」를 오너 결정 11-02 17:28 견본 A 꼴로 다시 지음 · R19 의 2×3 그림 TenYearChart.tsx 는 지우지 않고 남김)
 *
 * 지금 홈(/)은 그대로 두고 따로 선 길이다. 검색 색인 0(noindex · sitemap 에 없음).
 * 어두운 판: ① 「한국 · 최근 10년」 · 제목 · 한 줄 → 주인공 그래프 하나(8/12) + 오늘의 큰 수 셋(4/12) → 나머지 다섯 띠
 *           ② 연구는 무엇을 말하나 · Statory 서재(카드 묶음이 있을 때만 · 견본이면 띠)
 * 밝은 판:   ③ 여섯 부처 표 → 중독사회 수집 논문(접기) → 연대기 다섯 → 회복자원 → 다음 발표 → 운영 수 한 줄 (R19 그대로)
 * 수는 모두 운영 API · Statory 묶음의 저장된 값 그대로. 화면용으로 만드는 것은 「앞 조사 대비 ±」 · 「n배」(발표 값 둘의
 * 나눗셈 · 소수 1자리) · 지수 토글뿐(lib/homeV2 · lib/homeV3). 모델 호출 0.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homeV3' });
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
  const t3 = await getTranslations('homeV3');
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
  const sourceById = new Map<string, Source>(
    (sourceList?.data ?? []).map((s) => [s.id, s]),
  );

  // 단위 꼬리 — ko 는 붙여 쓰고(11,916명 · 12.6%) en 은 띄움(23,403 persons)
  const unitSuffix = (unit: string | null) => {
    const u = unitLabel(unit, l);
    if (!u) return '';
    return u === '%' || l === 'ko' ? u : ` ${u}`;
  };

  // ① 유형별 대표 지표(값이 있는 것만 · 빈 그림 0)
  const panels: Array<SeriesPanel & { indicator: Indicator }> = [];
  for (const type of ADDICTION_TYPES) {
    const det = details.get(TYPE_REPRESENTATIVE[type]);
    if (!det) continue;
    const series = totalSeries(det.observations);
    if (series.length < 2) continue;
    panels.push({
      type,
      typeLabel: typeLabel(type),
      code: det.indicator.code,
      name: indicatorName(det.indicator),
      unit: unitSuffix(det.indicator.unit),
      series: series.map((o) => ({ period: o.period, value: o.value })),
      breakYears: det.indicator.breakYears ?? null,
      href: `/indicators/${det.indicator.code}`,
      indicator: det.indicator,
    });
  }

  // ■2 주인공 — 첫 값 대비 바뀐 폭이 가장 큰 유형(설계 단절 계열은 후보 아님 · lib/homeV3)
  const heroRow = pickHero(panels);
  const hero = heroRow ? panels.find((p) => p.type === heroRow.type) ?? null : null;
  const strips = panels.filter((p) => p !== hero);

  // ■3 오늘의 큰 수 셋 — 오늘의 숫자(날마다 순환 · 지금 홈과 같은 고르기)에서 주인공 유형을 뺀 셋
  const candidates = seriesMeta
    .map((m) => details.get(m.code))
    .filter((det) => det !== undefined)
    .filter((det) => !hero || indicatorType(det.indicator.code) !== hero.type)
    .map((det) => {
      const series = totalSeries(det.observations);
      return { code: det.indicator.code, points: series.length, indicator: det.indicator, series };
    });
  const todayPick = pickTodaysNumber(candidates, new Date());
  const pool = candidates
    .filter((c) => c.points >= 2)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const tiles = todayPick ? threeFrom(pool, todayPick.index) : [];

  // ■5 Statory 서재 카드 — 실물 묶음이 있으면 실물, 없으면 견본(미리보기만 허락) · 둘 다 없으면 섹션 0
  const statory = loadStatoryExport({ allowSample: true });

  const fmtValue = (v: string) =>
    v.includes('.') || Number(v) < 1000 ? v : fmt(Number(v));

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

  return (
    <main className={serifKr.variable}>
      <div className={d.dark}>
      {/* ① 어두운 첫 화면 — 「한국 · 최근 10년」 → 제목 → 한 줄 → 주인공 · 큰 수 셋 · 다섯 띠 */}
      <section aria-labelledby="v3-title">
        <div className={d.kicker}>{t3('kicker')}</div>
        <h1 id="v3-title" className={d.title}>
          {t3('title')}
        </h1>
        <p className={d.lead}>{t3('lead')}</p>

        {!hero ? (
          <p className={d.lead}>{t('common.unavailable')}</p>
        ) : (
          <HeroBoard
            hero={hero}
            heroHead={(() => {
              const first = hero.series[0];
              const last = hero.series[hero.series.length - 1];
              const ratio = ratioText(first.value, last.value);
              const src = hero.indicator.sourceId
                ? sourceById.get(hero.indicator.sourceId)
                : undefined;
              return (
                <>
                  <span className={d.heroMeta}>
                    <span
                      className={d.typeDot}
                      style={{ background: typeColorVarDark(hero.type) }}
                      aria-hidden
                    />
                    <span className={d.heroType}>{hero.typeLabel}</span>
                    <Link href={hero.href} className={d.darkLink}>
                      {hero.name}
                    </Link>
                    {src && <span>{orgLabel(src, l)}</span>}
                    <span>
                      {t3('heroMeta', {
                        points: hero.series.length,
                        from: first.period,
                        to: last.period,
                      })}
                    </span>
                  </span>
                  <span className={d.heroNumberRow}>
                    <span className={d.heroNumber}>
                      {fmtValue(last.value)}
                      {hero.unit && <span className={d.heroUnit}>{hero.unit.trim()}</span>}
                    </span>
                    {ratio && (
                      <span className={d.heroRatio}>
                        {t3('heroRatio', {
                          lastYear: last.period,
                          firstYear: first.period,
                          firstValue: fmtValue(first.value),
                          unit: hero.unit,
                          ratio,
                        })}
                      </span>
                    )}
                  </span>
                </>
              );
            })()}
            heroMaxLabel={(period, value) =>
              t3('heroMax', { period, value, unit: hero.unit })
            }
            heroIndexMaxLabel={(period, value) => t3('heroIndexMax', { period, value })}
            strips={strips}
            stripNote={(p) => {
              const breaks = seriesBreakYears(
                p.series.map((s) => s.period),
                p.breakYears,
              );
              const base =
                breaks.length > 0
                  ? t3('stripBreak', { points: p.series.length })
                  : t3('stripPoints', {
                      points: p.series.length,
                      from: p.series[0].period,
                      to: p.series[p.series.length - 1].period,
                    });
              return NOT_ADDICTION_INDICATORS.has(p.code)
                ? `${t3('stripNotAddiction')} · ${base}`
                : base;
            }}
            tiles={tiles.map((c) => {
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
                c.indicator.unit === '%' ? tv('pointUnit') : unitSuffix(c.indicator.unit);
              return (
                <div key={c.code} className={d.tile}>
                  <div className={d.tileHead}>
                    <span
                      className={d.typeDot}
                      style={{ background: typeColorVarDark(type) }}
                      aria-hidden
                    />
                    {type && <span className={d.tileType}>{typeLabel(type)}</span>}
                    <Link href={`/indicators/${c.code}`} className={d.darkLink}>
                      {indicatorName(c.indicator)}
                    </Link>
                  </div>
                  <div className={d.tileValue}>
                    {fmtValue(last.value)}
                    {c.indicator.unit ? (
                      <span className={d.tileUnit}>{unitLabel(c.indicator.unit, l)}</span>
                    ) : null}
                  </div>
                  <p className={d.tileChange}>
                    {change.kind === 'delta'
                      ? t3('tileChange', {
                          year: last.period,
                          from: change.fromPeriod,
                          delta: `${change.text}${pointUnit}`,
                        })
                      : change.kind === 'break'
                        ? t3('tileChangeBreak', { year: last.period, from: change.fromPeriod })
                        : t3('tileChangeNone', { year: last.period })}
                  </p>
                  <p className={d.tileMeta}>
                    {src && <span>{orgLabel(src, l)} · </span>}
                    <a
                      href={last.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={d.darkLink}
                    >
                      {t('common.viewOriginal')}
                    </a>
                  </p>
                </div>
              );
            })}
            labels={{
              scaleRaw: tv('scaleRaw'),
              scaleIndex: tv('scaleIndex'),
              scaleIndexNote: t3('scaleIndexNote'),
              tilesLabel: t3('tilesLabel'),
              stripsLabel: t3('stripsLabel'),
            }}
          />
        )}
        <p className={d.trust}>{tv('trust')}</p>
        <p className={d.rule}>{t3('heroRule')}</p>
      </section>

      {/* ② 연구는 무엇을 말하나 · Statory 서재 — 묶음이 없으면 섹션 자체가 없다 */}
      {statory && <StatorySection loaded={statory} locale={l} />}
      </div>

      <div className={d.light}>

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
          <h2 className={styles.title}>{t3('collectedTitle')}</h2>
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
      </div>
    </main>
  );
}
