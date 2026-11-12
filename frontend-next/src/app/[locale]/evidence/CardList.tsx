import { getTranslations } from 'next-intl/server';
import {
  CARD_TYPES,
  doiHref,
  type EvidenceCard,
  type TileType,
  enSafe,
  excerptOf,
} from '@/lib/statoryEvidence';
import { statoryText } from '@/lib/previewMessages';
import { citeLine, countryName } from '../preview/home/StatorySection';
import styles from '../preview/home/v3.module.css';

/**
 * 근거 카드 목록 한 벌 — 유형 쪽(/evidence/<유형>)과 정책 쪽의 주제 쪽(/policy-map/research/<주제>)이 같이 쓴다(SOC-R24 ■3).
 * 카드 글 그대로(생성 0) · en 은 한글 글 대신 꼬리표. type = 이 쪽의 유형(「함께 다룬 유형」 줄에서 뺀다 · 없으면 카드 제 유형).
 */
export default async function CardList({
  cards,
  locale,
  type,
  start,
}: {
  cards: EvidenceCard[];
  locale: string;
  type?: TileType;
  start?: number;
}) {
  const t = statoryText(locale, 'main');
  const tt = await getTranslations({ locale, namespace: 'addictionType' });
  const fmt = (n: number) => n.toLocaleString(locale);
  return (
    <ol className={styles.cardList} start={start || undefined}>
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
            {!type && CARD_TYPES[c.type] !== 'other' && (
              <p className={styles.cite}>{tt(CARD_TYPES[c.type] as TileType)}</p>
            )}
            {(() => {
              // v1.1 types(보조) — 이 쪽 유형과 「기타」를 뺀 나머지
              const also = c.types
                .map((x) => CARD_TYPES[x])
                .filter((s): s is TileType => s !== 'other' && s !== (type ?? CARD_TYPES[c.type]));
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
  );
}
