import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { typeColorVarDark } from '@/lib/addictionTypes';
import { statoryText } from '@/lib/previewMessages';
import {
  enSafe,
  excerptOf,
  shortQuote,
  typeTiles,
  type EvidenceCard,
  type LoadedExport,
} from '@/lib/statoryEvidence';
import styles from './v3.module.css';

/**
 * 「연구는 무엇을 말하나 · Statory 서재」 (SOC-R20 ■5 · R22 ■1) — 유형 타일 여섯.
 * 묶음이 없으면 부른 쪽이 이 섹션을 그리지 않는다(빈 칸 0).
 *  견본(미리보기만): 머리에 「견본 자료」 띠 · 글은 messages/preview.
 *  실물(대문 · R22): 띠 0 · 글은 messages 본 글 · 여섯 유형 모두 — 카드 0 인 유형은 「아직 카드 없음」 · 대표 문장은 두 문장까지(shortQuote).
 * 문장은 카드의 것 그대로(자르기만 · 요약·번역 생성 0).
 */

export function countryName(code: string, locale: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** 출처 한 줄(저자 · 연도 · 나라) — en 에서 한글 저자명은 꼬리표로 · 나라 빈 글은 「나라 미상」(R22 v1.1) */
export function citeLine(
  c: EvidenceCard,
  locale: string,
  koreanAuthors: string,
  countryUnknown: string,
): string {
  const authors = locale === 'ko' ? c.authors_short : (enSafe(c.authors_short) ?? koreanAuthors);
  const country = c.country ? countryName(c.country, locale) : countryUnknown;
  return [authors, String(c.year), country].filter(Boolean).join(' · ');
}

export default async function StatorySection({
  loaded,
  locale,
  footer,
  className,
}: {
  loaded: LoadedExport;
  locale: string;
  /** 섹션 끝 한 줄(R21 ■2 서재 규모) */
  footer?: ReactNode;
  /** 바깥 구간 꼴(R21 파랑 구간) — 없으면 R20 꼴 */
  className?: string;
}) {
  const sample = loaded.mode === 'sample';
  const t = statoryText(locale, sample ? 'preview' : 'main');
  const tt = await getTranslations('addictionType');
  const tiles = typeTiles(loaded.data, { includeEmpty: !sample });
  if (tiles.every((x) => x.n === 0)) return null;

  return (
    <section className={className ?? styles.statory} aria-labelledby="v3-statory-title">
      <div className={styles.kicker}>{t('kicker')}</div>
      <h2 id="v3-statory-title" className={styles.h2}>
        {t('title')}
      </h2>
      {sample && <p className={styles.sampleBand}>{t('sampleBand')}</p>}
      <p className={styles.lead}>{t('desc')}</p>
      <div className={styles.cardGrid}>
        {tiles.map((tile) => {
          const lead = tile.lead;
          const ex = lead ? excerptOf(lead, locale) : null;
          return (
            <article
              key={tile.type}
              className={styles.typeCard}
              style={{ borderTop: `3px solid ${typeColorVarDark(tile.type)}` }}
            >
              <h3 className={styles.typeCardHead}>
                <span
                  className={styles.typeDot}
                  style={{ background: typeColorVarDark(tile.type) }}
                  aria-hidden
                />
                {tt(tile.type)}
              </h3>
              {tile.n === 0 ? (
                <p className={styles.typeCardCount}>{t('tileEmpty')}</p>
              ) : (
                <p className={styles.typeCardCount}>
                  {t('tileCount', {
                    n: tile.n,
                    k: tile.korea,
                    from: tile.yearFrom,
                    to: tile.yearTo,
                  })}
                </p>
              )}
              {lead && ex && (
                <>
                  {ex.kind === 'text' ? (
                    <p className={styles.quote}>
                      {sample ? ex.text : shortQuote(ex.text)}
                      {ex.tag === 'source' && <span className={styles.tag}>{t('sourceTag')}</span>}
                    </p>
                  ) : ex.kind === 'korean' ? (
                    <p className={styles.quote}>
                      <span className={styles.tag}>{t('koreanTag')}</span>
                    </p>
                  ) : (
                    <p className={styles.cite}>{t('noExcerpt')}</p>
                  )}
                  <p className={styles.cite}>
                    {citeLine(lead, locale, t('koreanAuthors'), t('countryUnknown'))}
                  </p>
                </>
              )}
              {tile.n > 0 && (
                <p className={styles.typeCardMore}>
                  <Link
                    href={`/evidence/${tile.type}`}
                    className={styles.darkLink}
                    aria-label={`${tt(tile.type)} · ${t('tileMore')}`}
                  >
                    {t('tileMore')}
                  </Link>
                </p>
              )}
            </article>
          );
        })}
      </div>
      {footer}
    </section>
  );
}
