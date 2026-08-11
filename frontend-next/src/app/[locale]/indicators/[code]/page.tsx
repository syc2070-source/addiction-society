import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { fetchIndicator, type Observation } from '@/lib/api';

/** 지표 상세 (/indicators/{code}) — 정의·읽는 법 + 추이(시계열 차트) + 분해 + 원본 딥링크(원칙3). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}): Promise<Metadata> {
  const { locale, code } = await params;
  const result = await fetchIndicator(code);
  if (result?.indicator) {
    const title =
      locale === 'en' && result.indicator.nameEn
        ? result.indicator.nameEn
        : result.indicator.nameKo;
    return { title };
  }
  const t = await getTranslations({ locale, namespace: 'indicatorsPage' });
  return { title: t('title') };
}

/** 관측치 정렬(기간 오름차순) */
function byPeriod(a: Observation, b: Observation) {
  return a.period.localeCompare(b.period);
}

/** 전체 시계열(qualifier='total')로 초소형 SVG 라인차트. 2점 이상일 때만 호출. */
function Sparkline({ series }: { series: Observation[] }) {
  const W = 560;
  const H = 180;
  const PAD = 28;
  const vals = series.map((o) => Number(o.value));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = series.length;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (n - 1);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const pts = series.map((o, i) => `${x(i)},${y(Number(o.value))}`).join(' ');

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline className="spark-line" points={pts} fill="none" />
      {series.map((o, i) => {
        const cx = x(i);
        const cy = y(Number(o.value));
        return (
          <g key={o.id}>
            <circle className="spark-dot" cx={cx} cy={cy} r={3.5} />
            <text className="spark-val" x={cx} y={cy - 8} textAnchor="middle">
              {o.value}
            </text>
            <text
              className="spark-x"
              x={cx}
              y={H - 8}
              textAnchor="middle"
            >
              {o.period}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function IndicatorDetailPage({
  params,
}: PageProps<'/[locale]/indicators/[code]'>) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations('indicatorsPage');
  const tc = await getTranslations('common');
  const result = await fetchIndicator(code);
  const indicator = result?.indicator ?? null;
  const observations = result?.observations ?? [];

  const totalSeries = observations
    .filter((o) => o.qualifier === 'total')
    .sort(byPeriod);
  const decomposed = observations
    .filter((o) => o.qualifier && o.qualifier !== 'total')
    .sort(byPeriod);

  // 분해: qualifier별로 묶기 ('group=남학생' → '남학생')
  const qualLabel = (q: string) =>
    q === 'total' ? t('qualTotal') : q.replace(/^group=/, '');
  const groups = new Map<string, Observation[]>();
  for (const o of decomposed) {
    const key = o.qualifier ?? 'total';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const hasTrend = totalSeries.length >= 2;
  // 회차마다 조사대상(note)이 다르면 추이 비교에 주의가 필요하다(AS-PDF-RUN).
  const seriesNotes = new Set(
    totalSeries.map((o) => o.note ?? '').filter(Boolean),
  );
  const seriesBreak = hasTrend && seriesNotes.size > 1;

  return (
    <main className="page-container">
      <div className="page-header">
        <Link href="/indicators" className="ext-link">
          {t('backToList')}
        </Link>

        {!result ? (
          <p className="status-note">{tc('unavailable')}</p>
        ) : !indicator ? (
          <p className="status-note">{t('notFound')}</p>
        ) : (
          <>
            <div className="page-kicker" style={{ marginTop: 'var(--space-2)' }}>
              {indicator.domain}
              {indicator.unit ? ` · ${indicator.unit}` : ''}
            </div>
            <h1 className="page-title">
              {l === 'en' && indicator.nameEn
                ? indicator.nameEn
                : indicator.nameKo}
            </h1>

            {/* 정의 + 이 지표 읽는 법 */}
            <section className="report-section">
              <h2>{t('definition')}</h2>
              <p>{indicator.definitionKo}</p>
              <h3 className="read-guide-title">{t('readGuide')}</h3>
              {indicator.methodNote ? (
                <p className="list-item-meta">{indicator.methodNote}</p>
              ) : null}
              {!hasTrend && (
                <p className="status-note">{t('trendPending')}</p>
              )}
            </section>

            {/* 추이(시계열) */}
            {hasTrend && (
              <section className="report-section">
                <h2>{t('trend')}</h2>
                {/*
                  회차 간 조사대상이 다르면 추이선을 그대로 읽으면 안 된다
                  (AS-PDF-RUN). 예: kcgp 청소년 도박 실태조사는 고3·초등 포함
                  여부가 회차마다 달라 급감·급증처럼 보이는 구간이 생긴다.
                  선을 감추는 대신 경고를 붙인다 — 숨기면 정보가 사라지고,
                  경고 없이 그리면 오독을 부른다.
                */}
                {seriesBreak && (
                  <p className="status-note">{t('comparabilityWarning')}</p>
                )}
                <Sparkline series={totalSeries} />
                {seriesBreak && (
                  <ul className="series-notes">
                    {totalSeries
                      .filter((o) => o.note)
                      .map((o) => (
                        <li key={o.id}>
                          <b>{o.period}</b> {o.note}
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )}

            {/* 분해 */}
            {groups.size > 0 && (
              <section className="report-section">
                <h2>{t('breakdown')}</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('colGroup')}</th>
                        <th>{t('colPeriod')}</th>
                        <th>{t('colValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...groups.entries()].flatMap(([q, rows]) =>
                        rows.map((o) => (
                          <tr key={o.id}>
                            <td>{qualLabel(q)}</td>
                            <td>{o.period}</td>
                            <td>
                              {o.value}
                              {indicator.unit ? ` ${indicator.unit}` : ''}
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 전체 관측치 (원본 딥링크) */}
            <section className="report-section">
              <h2>{t('series')}</h2>
              {observations.length === 0 ? (
                <p className="status-note">{tc('collectingEmpty')}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('colGeo')}</th>
                        <th>{t('colPeriod')}</th>
                        <th>{t('colGroup')}</th>
                        <th>{t('colValue')}</th>
                        <th>{t('colNote')}</th>
                        <th>{t('colSource')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...observations].sort(byPeriod).map((o) => (
                        <tr key={o.id}>
                          <td>{o.geo}</td>
                          <td>{o.period}</td>
                          <td>{qualLabel(o.qualifier ?? 'total')}</td>
                          <td>
                            {o.value}
                            {indicator.unit ? ` ${indicator.unit}` : ''}
                            {o.valueLow && o.valueHigh
                              ? ` (${o.valueLow}–${o.valueHigh})`
                              : ''}
                          </td>
                          <td className="cell-note">{o.note ?? ''}</td>
                          <td>
                            <a
                              href={o.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ext-link"
                            >
                              {tc('viewOriginal')}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
