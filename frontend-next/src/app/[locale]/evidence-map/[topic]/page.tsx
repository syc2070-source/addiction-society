import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import {
  doiUrl,
  evidenceTitle,
  evidenceTopics,
  loadEvidenceMap,
  type EvidencePaper,
  type Pair,
} from '@/lib/evidenceMap';
import styles from '../em.module.css';

/**
 * 근거 지도 한 주제 (/evidence-map/{topic}, SOC-R2 ■2).
 * Statory 묶음 JSON 의 수를 그대로 그린다 — 추정 0 · 나누기 0(비율은 「있음/전체」).
 * 주제는 public/data/evidence_map/index.json 에서 온다. 목록에 없으면 404,
 * 목록에는 있는데 파일이 없으면 「준비 중」.
 */

type Params = { locale: string; topic: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    evidenceTopics().map((topic) => ({ locale, topic })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, topic } = await params;
  const t = await getTranslations({ locale, namespace: 'evidenceMap' });
  const m = await loadEvidenceMap(topic);
  return { title: m ? `${evidenceTitle(m, locale)} · ${t('title')}` : t('title') };
}

function PairList({ items, locale }: { items: Pair[]; locale: string }) {
  return (
    <ul className={styles.pairList}>
      {items.map(([k, n]) => (
        <li key={k}>
          {k}
          <b>{n.toLocaleString(locale)}</b>
        </li>
      ))}
    </ul>
  );
}

function PaperItem({
  p,
  cited,
  kind,
}: {
  p: EvidencePaper;
  cited: string | null;
  kind: string | null;
}) {
  const meta = [p.journal, p.year, kind, cited].filter(Boolean).join(' · ');
  return (
    <li>
      {p.doi ? (
        <a
          href={doiUrl(p.doi)}
          target="_blank"
          rel="noopener noreferrer"
          className="ext-link"
        >
          {p.title}
        </a>
      ) : (
        p.title
      )}
      {meta && <span className={styles.paperMeta}>{meta}</span>}
    </li>
  );
}

export default async function EvidenceMapTopicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, topic } = await params;
  setRequestLocale(locale);
  if (!evidenceTopics().includes(topic)) notFound();

  const t = await getTranslations('evidenceMap');
  const m = await loadEvidenceMap(topic);
  const fmt = (n: number) => n.toLocaleString(locale);

  if (!m) {
    return (
      <main className="page-container">
        <div className="page-header">
          <div className="page-kicker">{t('kicker')}</div>
          <h1 className="page-title">{topic}</h1>
          <p className="status-note">{t('pending')}</p>
        </div>
        <Link href="/evidence-map" className="ext-link">
          {t('back')}
        </Link>
      </main>
    );
  }

  const max = Math.max(1, ...m.byYear.map((y) => y.count));
  const kindLabel = (k: string | null | undefined) =>
    k === 'systematic' || k === 'narrative' ? t(`reviewKind.${k}`) : k ?? null;
  const citedLabel = (c: number | null) =>
    c === null ? null : t('cited', { count: fmt(c) });

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{evidenceTitle(m, locale)}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{t('studies')}</span>
          <span className={styles.summaryValue}>{fmt(m.studies)}</span>
        </div>
        {m.trend && (
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>{t('trend')}</span>
            <span className={styles.summaryValue}>
              {t('trendValue', {
                last: fmt(m.trend.lastFive),
                before: fmt(m.trend.fiveBefore),
              })}
            </span>
          </div>
        )}
        {m.openAccess !== null && (
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>{t('openAccess')}</span>
            <span className={styles.summaryValue}>
              {t('openValue', {
                open: fmt(m.openAccess),
                total: fmt(m.studies),
              })}
            </span>
          </div>
        )}
        {m.fullTextHeld !== null && (
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>{t('fullTextHeld')}</span>
            <span className={styles.summaryValue}>{fmt(m.fullTextHeld)}</span>
          </div>
        )}
      </div>

      {m.byYear.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('byYear')}</h2>
          <div className={styles.bars} role="img" aria-label={t('byYear')}>
            {m.byYear.map((y) => (
              <div key={y.year} className={styles.bar} title={`${y.year}: ${y.count}`}>
                <span className={styles.barCount}>{y.count}</span>
                <span
                  className={styles.barFill}
                  style={{ height: `${(y.count / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className={styles.barYears}>
            <span>{m.byYear[0].year}</span>
            <span>{m.byYear[m.byYear.length - 1].year}</span>
          </div>
        </section>
      )}

      <div className={styles.two}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('instruments')}</h2>
          <PairList items={m.instruments} locale={locale} />
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('designs')}</h2>
          <PairList items={m.designs} locale={locale} />
        </section>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('countries')}</h2>
        {m.countries.length === 0 ? (
          <p className="status-note">{t('countriesNone')}</p>
        ) : (
          <PairList items={m.countries} locale={locale} />
        )}
      </section>

      <div className={styles.two}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {t('corePapers', { count: Math.min(10, m.corePapers.length) })}
          </h2>
          <ol className={styles.papers}>
            {m.corePapers.slice(0, 10).map((p) => (
              <PaperItem
                key={p.doi ?? p.title}
                p={p}
                cited={citedLabel(p.cited)}
                kind={null}
              />
            ))}
          </ol>
          {m.coreBasis && (
            <p className={styles.note}>
              {t('coreBasis', { basis: m.coreBasis })}
            </p>
          )}
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {t('reviews', { count: Math.min(5, m.reviews.length) })}
          </h2>
          <ol className={styles.papers}>
            {m.reviews.slice(0, 5).map((p) => (
              <PaperItem
                key={p.doi ?? p.title}
                p={p}
                cited={citedLabel(p.cited)}
                kind={kindLabel(p.kind)}
              />
            ))}
          </ol>
        </section>
      </div>

      {m.levels && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('levels')}</h2>
          <ul className={styles.pairList}>
            {(['fulltext', 'abstract', 'indirect', 'bib_only'] as const).map(
              (k) => (
                <li key={k}>
                  {t(`level.${k}`)}
                  <b>{fmt(m.levels![k])}</b>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('gaps')}</h2>
        <ul className={styles.papers}>
          {m.levels && (
            <li>
              {t('gapNoFullText', {
                none: fmt(m.levels.bib_only),
                total: fmt(m.studies),
              })}
            </li>
          )}
          {m.gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>

      {m.honesty.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('honesty')}</h2>
          <ul className={styles.papers}>
            {m.honesty.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.sourceLine}>
        {t('sourceLine', { date: (m.generatedAt ?? '').slice(0, 10) || '—' })}
        {m.source ? ` · ${m.source}` : ''}
      </p>
      <Link href="/evidence-map" className="ext-link">
        {t('back')}
      </Link>
    </main>
  );
}
