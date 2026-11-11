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
import {
  allRests,
  hrefOf,
  isSplit,
  parseRest,
  sliceView,
  topicCounts,
  type EvidenceView,
} from '@/lib/evidencePages';
import { citeLine, countryName } from '../../../preview/home/StatorySection';
import { serifKr } from '../../../preview/home/serifFont';
import styles from '../../../preview/home/v3.module.css';
import v from '../../../preview/home/v4.module.css';

/**
 * 「연구는 무엇을 말하나」 유형 쪽 (/evidence/<유형> · SOC-R20 ■5 · R23 ■2 나눔).
 * Statory 서재 카드 묶음(evidence_export_v1)을 읽기 전용으로 — 카드 목록(연도 내림) · 발췌 · 출처 · 면허.
 * 100장을 넘는 유형은 한 쪽 40장 · 하위 주제(예방 · 치료 · 정책 · 청소년 · 그 밖)로 거르기 — 주소 꼴은 lib/evidencePages.
 * 모두 빌드 때 정적(쿼리 0 · 클라이언트 JS 0). 색인: 전체 쪽들(1 · 2 · …)만 · 주제 쪽은 noindex,follow(같은 카드의 겹침).
 * 실물 묶음이 없으면 404(견본 길은 SOC-R23 ■1 에서 지움).
 * 문장은 카드 그대로(생성 0) · en 은 한글 글 대신 꼬리표(en 화면 한글 0 관문).
 */

type Params = { locale: string; type: string; rest?: string[] };

export const dynamicParams = false;

export function generateStaticParams() {
  const loaded = loadStatoryExport();
  return routing.locales.flatMap((locale) =>
    ADDICTION_TYPES.flatMap((type) =>
      (loaded ? allRests(cardsOfType(loaded.data, type)) : [[]]).map((rest) => ({
        locale,
        type,
        rest,
      })),
    ),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, type, rest } = await params;
  const loaded = loadStatoryExport();
  const t = statoryText(locale, 'main');
  const tt = await getTranslations({ locale, namespace: 'addictionType' });
  const view = parseRest(rest);
  const cards = loaded && isAddictionType(type) ? cardsOfType(loaded.data, type) : [];
  const slice = view ? sliceView(cards, view) : null;
  // R22 ■3: 그 유형에 카드가 있을 때만 색인(sitemap 과 같은 잣대) · R23: 주제 쪽은 noindex,follow
  const indexable = cards.length > 0 && !!view && !view.topic;
  const base = isAddictionType(type) ? t('pageMeta', { type: tt(type) }) : t('kicker');
  const parts = [
    base,
    view?.topic ? t(`topic.${view.topic}`) : null,
    slice && slice.pages > 1 ? t('pageOf', { page: slice.page, pages: slice.pages }) : null,
  ].filter(Boolean);
  return {
    title: parts.join(' · '),
    robots: indexable
      ? undefined
      : cards.length > 0
        ? { index: false, follow: true }
        : { index: false, follow: false },
  };
}

export default async function EvidenceTypePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, type, rest } = await params;
  if (!isAddictionType(type)) notFound();
  setRequestLocale(locale);
  const loaded = loadStatoryExport();
  if (!loaded) notFound();
  const view = parseRest(rest);
  if (!view) notFound();

  const t = statoryText(locale, 'main');
  const tt = await getTranslations('addictionType');
  const all = cardsOfType(loaded.data, type);
  const slice = sliceView(all, view);
  if (!slice) notFound();
  const cards = slice.cards;
  const split = isSplit(all.length);
  const fmt = (n: number) => n.toLocaleString(locale);
  const go = (to: EvidenceView) => hrefOf(type, to);
  const topics = split ? topicCounts(all).filter((x) => x.n > 0) : [];

  return (
    <main className={`${styles.dark} ${styles.page} ${v.page} ${serifKr.variable} blue-preview`}>
      <div className={v.inner}>
      <p>
        <Link href="/" className={styles.darkLink}>
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
      <p className={styles.lead}>
        {t('pageHead', { date: loaded.data.exported_at.slice(0, 10) })}
      </p>
      <p className={styles.rule}>
        {t('pageCount', { n: fmt(all.length), k: fmt(all.filter(isKorea).length) })}
      </p>

      {split && (
        <nav className={v.topicNav} aria-label={t('topicNav')}>
          <ul className={v.chips}>
            <li>
              <Link
                href={go({ topic: null, page: 1 })}
                className={view.topic === null ? `${v.chip} ${v.chipOn}` : v.chip}
                aria-current={view.topic === null ? 'page' : undefined}
              >
                {t('topic.all')} <span className={v.chipN}>{fmt(all.length)}</span>
              </Link>
            </li>
            {topics.map((x) => (
              <li key={x.topic}>
                <Link
                  href={go({ topic: x.topic, page: 1 })}
                  className={view.topic === x.topic ? `${v.chip} ${v.chipOn}` : v.chip}
                  aria-current={view.topic === x.topic ? 'page' : undefined}
                >
                  {t(`topic.${x.topic}`)} <span className={v.chipN}>{fmt(x.n)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.rule}>{t('topicRule')}</p>
        </nav>
      )}
      {split && (
        <p className={styles.rule} aria-live="polite">
          {t('showing', { from: fmt(slice.from), to: fmt(slice.to), n: fmt(slice.total) })}
          {slice.pages > 1 && <> · {t('pageOf', { page: slice.page, pages: slice.pages })}</>}
        </p>
      )}

      <ol className={styles.cardList} start={slice.from || undefined}>
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

      {slice.pages > 1 && (
        <nav className={v.pager} aria-label={t('pagerNav')}>
          {slice.page > 1 ? (
            <Link href={go({ topic: view.topic, page: slice.page - 1 })} className={v.chip} rel="prev">
              {t('prev')}
            </Link>
          ) : (
            <span className={`${v.chip} ${v.chipOff}`} aria-hidden>
              {t('prev')}
            </span>
          )}
          <ol className={v.chips}>
            {Array.from({ length: slice.pages }, (_, i) => i + 1).map((p) => (
              <li key={p}>
                <Link
                  href={go({ topic: view.topic, page: p })}
                  className={p === slice.page ? `${v.chip} ${v.chipOn}` : v.chip}
                  aria-current={p === slice.page ? 'page' : undefined}
                >
                  {p}
                </Link>
              </li>
            ))}
          </ol>
          {slice.page < slice.pages ? (
            <Link href={go({ topic: view.topic, page: slice.page + 1 })} className={v.chip} rel="next">
              {t('next')}
            </Link>
          ) : (
            <span className={`${v.chip} ${v.chipOff}`} aria-hidden>
              {t('next')}
            </span>
          )}
        </nav>
      )}
      </div>
    </main>
  );
}
