import { Fragment, type ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
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
import { evidenceTitle, evidenceTopics, loadEvidenceMap } from '@/lib/evidenceMap';
import { MINISTRY_MAP } from '@/data/ministry-map';
import { pickTodaysNumber } from '@/lib/todayNumber';
import {
  broadcastLineLabels,
  cityLabel,
  orgLabel,
  recoveryNameLabel,
  unitLabel,
} from '@/lib/enLabels';
import {
  ADDICTION_TYPES,
  NOT_ADDICTION_INDICATORS,
  TYPE_REPRESENTATIVE,
  indicatorType,
  sourceType,
  titleType,
  typeColorVarDark,
  type AddictionType,
} from '@/lib/addictionTypes';
import { seriesBreakYears } from '@/lib/seriesBreaks';
import { changeFromPrevious, threeFrom } from '@/lib/homeV2';
import { pickHero, ratioText } from '@/lib/homeV3';
import { libraryScale, showTypeLabel } from '@/lib/homeV4';
import { loadStatoryExport } from '@/lib/statoryEvidence';
import { homeV3Text, homeV4Text } from '@/lib/previewMessages';
import HeroBoard, { type SeriesPanel } from './HeroBoard';
import StatorySection from './StatorySection';
import { serifKr } from './serifFont';
import d from './v3.module.css';
import v from './v4.module.css';

/**
 * 홈 v4 · 전체 파랑 (SOC-R21 지음 · R22 ■2 대문으로) — 한 컴포넌트를 두 길이 부른다.
 *   mode 'home'    = / · /en (공개 대문) — 글 = messages 본 글 · Statory 는 실물 묶음만(견본 0 · 실물 없으면 구간 0)
 *   mode 'preview' = /preview/home (noindex) — 글 = messages/preview · 실물 없으면 견본(띠 있음)
 * 구간(위 → 아래 · 파랑의 단만 한 칸씩): blue-0 첫 화면 · 서재 | blue-up 누가 맡고 있나 | blue-down 무엇이 나왔나 |
 *   blue-0 어디서 도움을 받나 | blue-deep 바닥 한 줄.
 * 수는 모두 운영 API · Statory 묶음의 저장된 값 그대로. 화면용으로 만드는 것은 「앞 조사 대비 ±」 · 「n배」 · 지수 토글 ·
 * 서재 규모 합뿐. 모델 호출 0.
 */

export type HomeMode = 'home' | 'preview';

const isTotal = (o: Observation) => !o.qualifier || o.qualifier === 'total';

/** 전체값 시계열(기간 오름차순 · 기간이 겹치면 하나) */
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

/** 「a · b · c」 — 빈 칸은 빼고 가운데점으로 잇는다(R22 ■4) */
function dotJoin(parts: ReactNode[]): ReactNode {
  const kept = parts.filter((p) => p !== null && p !== false && p !== '' && p !== undefined);
  return kept.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && ' · '}
      {p}
    </Fragment>
  ));
}

/** 구간 하나 — 꼬리말 → 제목 → 한 줄 설명 → 내용 (R21 ■7 문법) */
function Section({
  id,
  tone,
  kicker,
  title,
  desc,
  children,
}: {
  id: string;
  tone: string;
  kicker: string;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${v.section} ${tone}`} aria-labelledby={id}>
      <div className={v.inner}>
        <div className={v.kicker}>{kicker}</div>
        <h2 id={id} className={v.title}>
          {title}
        </h2>
        {desc && <p className={v.desc}>{desc}</p>}
        <div className={v.body}>{children}</div>
      </div>
    </section>
  );
}

export default async function HomeV4({ locale, mode }: { locale: AppLocale; mode: HomeMode }) {
  const l = locale;
  const source = mode === 'home' ? 'main' : 'preview';
  const t = await getTranslations();
  const tv = await getTranslations('homeV2');
  const t3 = homeV3Text(l, source);
  const t4 = homeV4Text(l, source);
  const fmt = (n: number) => n.toLocaleString(l);

  const [summary, indicatorList, policy, timeline, calendar, sourceList, recoveryAll, maps] =
    await Promise.all([
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
      .filter((x) => x !== null)
      .map((x) => [x.indicator.code, x]),
  );

  const indicatorName = (i: Indicator) => (l === 'en' && i.nameEn ? i.nameEn : i.nameKo);
  const typeLabel = (type: AddictionType) => t(`addictionType.${type}`);
  const sourceById = new Map<string, Source>((sourceList?.data ?? []).map((s) => [s.id, s]));

  // 단위 꼬리 — ko 는 붙여 쓰고(11,916명 · 12.6%) en 은 띄움(23,403 persons)
  const unitSuffix = (unit: string | null) => {
    const u = unitLabel(unit, l);
    if (!u) return '';
    return u === '%' || l === 'ko' ? u : ` ${u}`;
  };
  const fmtValue = (val: string) => (val.includes('.') || Number(val) < 1000 ? val : fmt(Number(val)));

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

  // 주인공 — 첫 값 대비 바뀐 폭이 가장 큰 유형(설계 단절 계열은 후보 아님 · R20 규칙 그대로)
  const heroRow = pickHero(panels);
  const hero = heroRow ? (panels.find((p) => p.type === heroRow.type) ?? null) : null;
  const strips = panels.filter((p) => p !== hero);

  // 오늘의 큰 수 셋 — 주인공 유형을 뺀 오늘의 숫자 셋(R20 그대로)
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

  // ② Statory 카드 — 대문은 실물만(견본 0 · 실물 없으면 구간 0) · 미리보기는 실물 → 견본 · 서재 규모(Europe PMC 주제 묶음 합)
  const statory = loadStatoryExport({ allowSample: mode === 'preview' });
  const scale = libraryScale(maps);
  const topicNames = maps.filter((m) => m !== null).map((m) => evidenceTitle(m, l));

  // ④ 연대기 최근 다섯 — 손님 사건만(발간 감지 · 방송) · R19 규칙 그대로
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
        title: (l === 'en' ? e.titleEn || e.titleKo : e.titleKo || e.titleEn) || e.sourceId,
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

  // ④ 다음 발표 — 발표 달력(이번 달) + 관측소 「다음 발표 예정」(R19 목록 그대로)
  const month = currentMonthKst();
  const nextRows: Array<{ key: string; ym: string; title: string; org: string; url: string | null }> = [];
  const seen = new Set<string>();
  for (const s of (calendar ?? []).filter((s) => String(s.nextExpectedAt ?? '').startsWith(month))) {
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

  // ⑤ 회복자원 — 지역별 곳 수 · 상위 6 + 펼침 · 상담전화(저장된 hotline 행 그대로 · 지금 0)
  const resources = recoveryAll?.data ?? [];
  const byCity = new Map<string, number>();
  for (const r of resources) if (r.city) byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  const cityRows = [...byCity.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  const cityMax = Math.max(1, ...cityRows.map(([, n]) => n));
  const TOP = 6;
  const hotlines = resources.filter((r) => r.type === 'hotline' && r.phone);
  const recoveryAction = l === routing.defaultLocale ? '/recovery' : `/${l}/recovery`;
  const bars = (rows: Array<[string, number]>) => (
    <ul className={v.bars}>
      {rows.map(([city, n]) => (
        <li key={city} className={v.bar}>
          <span className={v.barLabel}>{cityLabel(city, l)}</span>
          <span className={v.barTrack} aria-hidden>
            <span className={v.barFill} style={{ width: `${(n / cityMax) * 100}%` }} />
          </span>
          <span className={v.barValue}>{fmt(n)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <main className={`${v.page} ${serifKr.variable} blue-preview`}>
      {/* ① 첫 화면 */}
      <section className={`${v.section} ${v.tone0}`} aria-labelledby="v3-title">
        <div className={v.inner}>
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
                const src = hero.indicator.sourceId ? sourceById.get(hero.indicator.sourceId) : undefined;
                return (
                  <>
                    <span className={d.heroMeta}>
                      <span
                        className={d.typeDot}
                        style={{ background: typeColorVarDark(hero.type) }}
                        aria-hidden
                      />
                      <span>
                        {dotJoin([
                          showTypeLabel(hero.typeLabel, hero.name) ? (
                            <span className={d.heroType}>{hero.typeLabel}</span>
                          ) : null,
                          <Link key="n" href={hero.href} className={d.darkLink}>
                            {hero.name}
                          </Link>,
                          src ? orgLabel(src, l) : null,
                          t3('heroMeta', { points: hero.series.length, from: first.period, to: last.period }),
                        ])}
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
              heroMaxLabel={(period, value) => t3('heroMax', { period, value, unit: hero.unit })}
              heroIndexMaxLabel={(period, value) => t3('heroIndexMax', { period, value })}
              strips={strips}
              stripNote={(p) => {
                const breaks = seriesBreakYears(p.series.map((s) => s.period), p.breakYears);
                const base =
                  breaks.length > 0
                    ? t3('stripBreak', { points: p.series.length })
                    : t3('stripPoints', {
                        points: p.series.length,
                        from: p.series[0].period,
                        to: p.series[p.series.length - 1].period,
                      });
                return NOT_ADDICTION_INDICATORS.has(p.code) ? `${t3('stripNotAddiction')} · ${base}` : base;
              }}
              tiles={tiles.map((c) => {
                const last = c.series[c.series.length - 1];
                const type = indicatorType(c.code);
                const name = indicatorName(c.indicator);
                const change = changeFromPrevious(
                  c.series.map((o) => ({ period: o.period, value: o.value })),
                  c.indicator.breakYears,
                );
                const src = c.indicator.sourceId ? sourceById.get(c.indicator.sourceId) : undefined;
                const pointUnit = c.indicator.unit === '%' ? tv('pointUnit') : unitSuffix(c.indicator.unit);
                return (
                  <div key={c.code} className={d.tile}>
                    <div className={d.tileHead}>
                      <span
                        className={d.typeDot}
                        style={{ background: typeColorVarDark(type) }}
                        aria-hidden
                      />
                      <span>
                        {dotJoin([
                          type && showTypeLabel(typeLabel(type), name) ? (
                            <span className={d.tileType}>{typeLabel(type)}</span>
                          ) : null,
                          <Link key="n" href={`/indicators/${c.code}`} className={d.darkLink}>
                            {name}
                          </Link>,
                        ])}
                      </span>
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
                    {NOT_ADDICTION_INDICATORS.has(c.code) && (
                      <p className={d.tileMeta}>{t3('stripNotAddiction')}</p>
                    )}
                    <p className={d.tileMeta}>
                      {dotJoin([
                        src ? orgLabel(src, l) : null,
                        <a
                          key="o"
                          href={last.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={d.darkLink}
                        >
                          {t('common.viewOriginal')}
                        </a>,
                      ])}
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
        </div>
      </section>

      {/* ② 연구는 무엇을 말하나 · Statory 서재 — 묶음이 없으면 구간 자체가 없다(대문 = 실물만) */}
      {statory && (
        <div className={`${v.section} ${v.tone0}`}>
          <div className={v.inner}>
            <StatorySection
              loaded={statory}
              locale={l}
              className=""
              footer={
                scale ? (
                  <>
                    <p className={v.scaleLine}>
                      {t4('scaleLine', {
                        studies: fmt(scale.studies),
                        open: fmt(scale.openAccess),
                        recent: fmt(scale.lastFive),
                      })}
                    </p>
                    <p className={v.scaleNote}>
                      {t4('scaleNote', { topics: scale.topics, names: topicNames.join(' · ') })}
                    </p>
                  </>
                ) : null
              }
            />
          </div>
        </div>
      )}

      {/* ③ 누가 맡고 있나 */}
      <Section
        id="v4-who"
        tone={v.toneUp}
        kicker={t4('whoKicker')}
        title={t4('whoTitle')}
        desc={t('ministry.desc')}
      >
        <div className={v.tableWrap}>
          <table className={v.table} aria-label={t('ministry.tableLabel')}>
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
        <blockquote className={v.quote}>
          {t('ministry.quote')}
          <footer className={v.quoteBy}>{t('ministry.quoteBy')}</footer>
        </blockquote>
        <p className={v.footnote}>{t('ministry.footnote')}</p>
      </Section>

      {/* ④ 무엇이 나왔나 — 최근 다섯 | 다음 발표 */}
      <Section
        id="v4-what"
        tone={v.toneDown}
        kicker={t4('whatKicker')}
        title={t4('whatTitle')}
        desc={t4('whatDesc')}
      >
        <div className={v.twoCol}>
          <div>
            <h3 className={v.colTitle}>{t4('recentTitle')}</h3>
            {guestEvents.length === 0 ? (
              <p className={v.empty}>{timeline === null ? t('common.unavailable') : tv('timelineEmpty')}</p>
            ) : (
              <ul className={v.list}>
                {guestEvents.map((e) => (
                  <li key={e.key} className={v.event}>
                    <span className={v.date}>{e.date}</span>
                    <span
                      className={v.dot}
                      style={{ background: typeColorVarDark(e.type) }}
                      aria-hidden
                    />
                    <span className={v.eventBody}>
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className={v.link}>
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                      <span className={v.meta}>
                        {[e.kind, e.type ? typeLabel(e.type) : '', e.org].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={v.more}>
              <Link href="/timeline" className={v.link}>
                {tv('timelineMore')}
              </Link>
            </p>
          </div>
          <div>
            <h3 className={v.colTitle}>{t4('nextTitle')}</h3>
            {calendar === null && summary === null ? (
              <p className={v.empty}>{t('common.unavailable')}</p>
            ) : nextRows.length === 0 ? (
              <p className={v.empty}>{tv('nextEmpty')}</p>
            ) : (
              <ul className={v.list}>
                {nextRows.map((r) => (
                  <li key={r.key} className={v.nextItem}>
                    <span className={v.date}>{r.ym}</span>
                    <span className={v.eventBody}>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className={v.link}>
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                      {r.org && <span className={v.meta}>{r.org}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={v.more}>
              <Link href="/calendar" className={v.link}>
                {t('home.monthMore')}
              </Link>
            </p>
          </div>
        </div>
      </Section>

      {/* ⑤ 어디서 도움을 받나 */}
      <Section
        id="v4-help"
        tone={v.tone0}
        kicker={t4('helpKicker')}
        title={
          recoveryAll
            ? t4('helpTitle', { total: fmt(recoveryAll.total), regions: fmt(cityRows.length) })
            : tv('recoveryTitle')
        }
        desc={t4('helpDesc')}
      >
        <div className={v.helpGrid}>
          <div>
            <form method="get" action={recoveryAction} className={v.search}>
              <input
                type="text"
                name="search"
                placeholder={t('home.recoverySearch')}
                aria-label={t('home.recoverySearch')}
              />
              <button type="submit" className={v.searchButton}>
                {t('common.searchButton')}
              </button>
            </form>
            {recoveryAll === null ? (
              <p className={v.empty}>{t('common.unavailable')}</p>
            ) : (
              <>
                <div aria-label={t4('topRegions', { n: Math.min(TOP, cityRows.length) })} role="group">
                  {bars(cityRows.slice(0, TOP))}
                </div>
                {cityRows.length > TOP && (
                  <details className={v.allRegions}>
                    <summary>{t4('allRegions', { n: cityRows.length })}</summary>
                    {bars(cityRows)}
                  </details>
                )}
              </>
            )}
          </div>
          <aside className={v.helpCard} aria-labelledby="v4-help-card">
            <h3 id="v4-help-card" className={v.helpTitle}>
              {t4('helpCardTitle')}
            </h3>
            <p className={v.helpText}>{t('recoveryPage.desc')}</p>
            {hotlines.length > 0 && (
              <ul className={v.helpList} aria-label={t('home.recoveryType.hotline')}>
                {hotlines.map((r) => (
                  <li key={r.id}>
                    <span className={v.meta}>{t('home.recoveryType.hotline')}</span>
                    {recoveryNameLabel(r.name, l)}
                    <a href={`tel:${r.phone}`} className={`${v.link} ${v.phone}`}>
                      {r.phone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className={v.more}>
              <Link href="/recovery" className={v.link}>
                {t4('helpAll')}
              </Link>
            </p>
          </aside>
        </div>
      </Section>

      {/* ⑥ 바닥 한 줄 */}
      <footer className={v.bottom}>
        <div className={v.bottomInner}>
          <span>{t4('bottomLeft')}</span>
          <span>{t4('bottomRight')}</span>
        </div>
        <p className={v.stats}>
          {tv('footerStats', {
            sources: summary ? fmt(summary.total) : '—',
            indicators: indicatorList ? fmt(indicatorList.total) : '—',
            policy: policy ? fmt(policy.total) : '—',
            recovery: recoveryAll ? fmt(recoveryAll.total) : '—',
          })}
        </p>
      </footer>
    </main>
  );
}
