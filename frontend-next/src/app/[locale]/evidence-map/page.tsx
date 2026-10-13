import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  evidenceTitle,
  evidenceTopics,
  loadEvidenceMap,
} from '@/lib/evidenceMap';
import styles from './em.module.css';

/** 근거 지도 목록 (/evidence-map, SOC-R2 ■2) — index.json 의 주제마다 카드 하나. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'evidenceMap' });
  return { title: t('title') };
}

export default async function EvidenceMapIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evidenceMap');
  const th = await getTranslations('home');
  const topics = evidenceTopics();
  const maps = await Promise.all(topics.map((tp) => loadEvidenceMap(tp)));
  const fmt = (n: number) => n.toLocaleString(locale);

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      {topics.length === 0 ? (
        <p className="status-note">{t('listEmpty')}</p>
      ) : (
        <div className={styles.cards}>
          {topics.map((tp, i) => {
            const m = maps[i];
            return (
              <Link
                key={tp}
                href={`/evidence-map/${tp}`}
                className="list-item"
              >
                <h2 className="list-item-title">
                  {m ? evidenceTitle(m, locale) : tp}
                </h2>
                {m ? (
                  <div className="list-item-meta">
                    <span className="tag">
                      {th('mapStudies', { count: fmt(m.studies) })}
                    </span>
                    {m.trend && (
                      <span>
                        {th('mapTrend', {
                          last: fmt(m.trend.lastFive),
                          before: fmt(m.trend.fiveBefore),
                        })}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="status-note">{t('pending')}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
