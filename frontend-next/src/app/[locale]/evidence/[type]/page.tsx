import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import {
  ADDICTION_TYPES,
  isAddictionType,
  typeColorVarDark,
} from '@/lib/addictionTypes';
import {
  CARD_TYPES,
  cardsOfType,
  doiHref,
  type TileType,
  enSafe,
  excerptOf,
  isKorea,
  loadStatoryExport,
} from '@/lib/statoryEvidence';
import { statoryText } from '@/lib/previewMessages';
import { citeLine, countryName } from '../../preview/home/StatorySection';
import { serifKr } from '../../preview/home/serifFont';
import styles from '../../preview/home/v3.module.css';
import v from '../../preview/home/v4.module.css';

/**
 * 「연구는 무엇을 말하나」 유형 한 쪽 (/evidence/<유형> · SOC-R20 ■5).
 * Statory 서재 카드 묶음(evidence_export_v1)을 읽기 전용으로 — 카드 목록(연도 내림) · 발췌 · 출처 · 면허.
 * 실물 묶음이 없으면 견본(미리보기와 같은 분기) · 견본이면 noindex 와 「견본 자료」 띠 · 둘 다 없으면 404.
 * sitemap 에 없음. 문장은 카드 그대로(생성 0) · en 은 한글 글 대신 꼬리표(en 화면 한글 0 관문).
 */

type Params = { locale: string; type: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ADDICTION_TYPES.map((type) => ({ locale, type })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, type } = await params;
  const loaded = loadStatoryExport({ allowSample: true });
  const t = statoryText(locale, loaded?.mode === 'real' ? 'main' : 'preview');
  const tt = await getTranslations({ locale, namespace: 'addictionType' });
  // R22 ■3: 실물이고 그 유형에 카드가 있을 때만 색인(sitemap 과 같은 잣대) · 견본이면 noindex 그대로
  const indexable =
    loaded?.mode === 'real' && isAddictionType(type) && cardsOfType(loaded.data, type).length > 0;
  return {
    title: isAddictionType(type) ? t('pageMeta', { type: tt(type) }) : t('kicker'),
    robots: indexable ? undefined : { index: false, follow: false },
  };
}

export default async function EvidenceTypePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, type } = await params;
  if (!isAddictionType(type)) notFound();
  setRequestLocale(locale);
  const loaded = loadStatoryExport({ allowSample: true });
  if (!loaded) notFound();

  const real = loaded.mode === 'real';
  const t = statoryText(locale, real ? 'main' : 'preview');
  const tt = await getTranslations('addictionType');
  const cards = cardsOfType(loaded.data, type);
  const fmt = (n: number) => n.toLocaleString(locale);

  return (
    <main className={`${styles.dark} ${styles.page} ${v.page} ${serifKr.variable} blue-preview`}>
      <div className={v.inner}>
      <p>
        <Link href={real ? '/' : '/preview/home'} className={styles.darkLink}>
          {t('back')}
        </Link>
      </p>
      <div className={styles.kicker} style={{ marginTop: 'var(--space-3)' }}>
        {t('kicker')}
      </div>
      <h1 className={styles.title}>
        <span
          className={styles.typeDot}
          style={{
            background: typeColorVarDark(type),
            display: 'inline-block',
            marginRight: 12,
            verticalAlign: 'middle',
          }}
          aria-hidden
        />
        {tt(type)}
      </h1>
      {loaded.mode === 'sample' && <p className={styles.sampleBand}>{t('sampleBand')}</p>}
      <p className={styles.lead}>
        {t('pageHead', { date: loaded.data.exported_at.slice(0, 10) })}
      </p>
      <p className={styles.rule}>
        {t('pageCount', { n: cards.length, k: cards.filter(isKorea).length })}
      </p>

      <ol className={styles.cardList}>
        {cards.map((c) => {
          const ex = excerptOf(c, locale);
          const title = locale === 'ko' ? c.title : enSafe(c.title);
          return (
            <li key={c.card_id} className={styles.cardItem}>
              <h2 className={styles.cardTitle} lang={title && locale !== 'ko' ? 'en' : undefined}>
                {title ?? t('koreanTitle')}
              </h2>
              <p className={styles.cite}>
                {citeLine(c, locale, t('koreanAuthors'), t('countryUnknown'))}
              </p>
              {(() => {
                // v1.1 types(보조) — 이 쪽 유형과 「기타」를 뺀 나머지
                const also = c.types
                  .map((x) => CARD_TYPES[x])
                  .filter((s): s is TileType => s !== 'other' && s !== type);
                return also.length > 0 ? (
                  <p className={styles.cite}>
                    {t('alsoTypes')} · {also.map((s) => tt(s)).join(' · ')}
                  </p>
                ) : null;
              })()}
              {ex.kind === 'text' ? (
                <p className={styles.quote}>
                  {ex.text}
                  {ex.tag === 'source' && <span className={styles.tag}>{t('sourceTag')}</span>}
                </p>
              ) : ex.kind === 'korean' ? (
                <p className={styles.quote}>
                  <span className={styles.tag}>{t('koreanTag')}</span>
                </p>
              ) : c.license === 'quote_only' ? (
                <p className={styles.cite}>{t('noExcerpt')}</p>
              ) : null}
              {locale === 'ko' && c.implications_ko && c.license !== 'quote_only' && (
                <p className={styles.cite}>
                  {t('implications')} · {c.implications_ko}
                </p>
              )}
              <dl className={styles.facts}>
                <dt>{t('colCountry')}</dt>
                <dd>{c.country ? countryName(c.country, locale) : t('countryUnknown')}</dd>
                {c.sample_n !== null && (
                  <>
                    <dt>{t('colSample')}</dt>
                    <dd>{t('sampleN', { n: fmt(c.sample_n) })}</dd>
                  </>
                )}
                <dt>{t('colDesign')}</dt>
                <dd>{t(`design.${c.design}`)}</dd>
                {c.instrument && (locale === 'ko' || enSafe(c.instrument)) && (
                  <>
                    <dt>{t('colInstrument')}</dt>
                    <dd>{c.instrument}</dd>
                  </>
                )}
                <dt>{t('colLicense')}</dt>
                <dd>{t(`license.${c.license}`)}</dd>
                {c.source_grade && (locale === 'ko' || enSafe(c.source_grade)) && (
                  <>
                    <dt>{t('colGrade')}</dt>
                    <dd>{c.source_grade}</dd>
                  </>
                )}
              </dl>
              {(c.doi || c.url) && (
                <p className={styles.links}>
                  {c.doi && (
                    <a
                      href={doiHref(c.doi)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.darkLink}
                    >
                      {t('linkDoi')}
                    </a>
                  )}
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.darkLink}
                    >
                      {t('linkUrl')}
                    </a>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      </div>
    </main>
  );
}
