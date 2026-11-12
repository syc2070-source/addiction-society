import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { typeColorVarDark, type AddictionType } from '@/lib/addictionTypes';
import { cardsOfType, loadStatoryExport, TILE_TYPES } from '@/lib/statoryEvidence';
import { subtopicsOf, hrefOf } from '@/lib/evidencePages';
import { themeCounts } from '@/lib/policyThemes';
import { pageOpens, standingSections, timelineAreaCounts, type SectionKey } from '@/lib/policyMap';
import { selfAlternates } from '@/lib/pageMeta';
import {
  AREAS4,
  COUNTRIES,
  FIGURES,
  GAPS,
  LAYERS,
  LOCAL,
  MINISTRIES,
  MORE_FIGURES,
  REFERENCE,
  RESEARCH,
  SOURCES,
  TIMELINE,
  type Area,
  type L10n,
  type SourceId,
} from '@/data/policy-map';
import { serifKr } from '../preview/home/serifFont';
import styles from '../preview/home/v3.module.css';
import v from '../preview/home/v4.module.css';
import p from './policy.module.css';

/**
 * 「정책」 쪽 (/policy-map · SOC-R24 ■2 · 결정 3 · 5 · 7).
 * 칸 일곱 — ① 얼마나 ② 누가 맡고 있나(네 줄) ③ 무엇이 바뀌었나 ④ 어디가 비어 있나 ⑤ 다른 나라는 ⑥ 연구는 무엇을 말하나 ⑦ 지역은 지금.
 * 내용은 data/policy-map.ts(원자료 대조표에서 확인한 것만) · 칸 문턱은 lib/policyMap · 수치마다 출처 줄(누르면 원자료).
 * ⑥ 은 근거 카드로 잇는다(유형마다 정책 갈래 · 낱말 규칙 주제 둘) — 모델 판정 0.
 * 모두 빌드 때 정적(쿼리 0 · 클라이언트 JS 0). 서는 칸이 셋 이하면 noindex(미리보기 길만) — 결정 7.
 */

type Params = { locale: string };
const L = (x: L10n, locale: string) => (locale === 'ko' ? x.ko : x.en);

const AREA_TYPE: Record<Area, AddictionType | null> = {
  alcohol: 'alcohol',
  drugs: 'drug',
  gambling: 'gambling',
  digital: 'smartphone',
  common: null,
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'policyMap' });
  return {
    title: t('title'),
    description: t('desc'),
    alternates: selfAlternates(locale, '/policy-map'),
    robots: pageOpens(standingSections()) ? undefined : { index: false, follow: true },
  };
}

function Sources({ ids, locale, label }: { ids: SourceId[]; locale: string; label: string }) {
  if (ids.length === 0) return null;
  return (
    <p className={p.src}>
      {label} ·{' '}
      {ids.map((id, i) => {
        const s = SOURCES[id];
        const date = s.date === '현행' ? (locale === 'ko' ? '현행' : 'current') : s.date;
        return (
          <span key={id}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {L(s.org, locale)}, {L(s.title, locale)} ({date})
            </a>
          </span>
        );
      })}
    </p>
  );
}

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
    <section className={`${v.section} ${tone}`} aria-labelledby={id} id={id.replace(/^h-/, '')}>
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

function AreaTag({ area, label, type }: { area?: Area; label: string; type?: AddictionType }) {
  const ty = type ?? (area ? AREA_TYPE[area] : null);
  return (
    <span className={p.areaName}>
      <span className={p.areaDot} style={{ background: ty ? typeColorVarDark(ty) : 'var(--blue-muted)' }} aria-hidden />
      {label}
    </span>
  );
}

export default async function PolicyMapPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('policyMap');
  const tt = await getTranslations('addictionType');
  const fmt = (n: number) => n.toLocaleString(locale);
  const standing = new Set<SectionKey>(standingSections());
  const area = (a: Area) => t(`area.${a}`);
  const srcLabel = t('source');

  // ⑥ 근거 카드 — 유형마다 정책 갈래 수(근거 쪽 정책 갈래로) · 주제 둘(낱말 규칙)
  const loaded = loadStatoryExport();
  const policyLinks = loaded
    ? TILE_TYPES.map((type) => ({
        type,
        n: cardsOfType(loaded.data, type).filter((c) => subtopicsOf(c).includes('policy')).length,
      })).filter((x) => x.n > 0)
    : [];
  const themes = loaded ? themeCounts(loaded.data.cards) : [];
  const counts = timelineAreaCounts();

  const order: SectionKey[] = ['size', 'who', 'changes', 'gaps', 'abroad', 'research', 'local'];
  const tones = [v.tone0, v.toneUp, v.toneDown];
  const shownOrder = order.filter((k) => standing.has(k));
  const tone = (k: SectionKey) => tones[shownOrder.indexOf(k) % tones.length];

  return (
    <main className={`${styles.dark} ${styles.page} ${v.page} ${serifKr.variable} blue-preview`}>
      <section className={`${v.section} ${v.tone0}`} aria-labelledby="h-policy">
        <div className={v.inner}>
          <div className={v.kicker}>{t('kicker')}</div>
          <h1 id="h-policy" className={styles.title}>
            {t('title')}
          </h1>
          <p className={styles.lead}>{t('desc')}</p>
          <nav aria-label={t('tocLabel')}>
            <ol className={p.toc}>
              {shownOrder.map((k) => (
                <li key={k}>
                  <a href={`#${k}`}>{t(`toc.${k}`)}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      {standing.has('size') && (
        <Section id="h-size" tone={tone('size')} kicker={t('size.kicker')} title={t('size.title')} desc={t('size.desc')}>
          <ul className={p.figGrid} style={{ listStyle: 'none' }}>
            {FIGURES.map((f) => (
              <li
                key={f.label.en}
                className={p.fig}
                style={{ ['--fig-color' as string]: typeColorVarDark(AREA_TYPE[f.area]) }}
              >
                <AreaTag area={f.area} label={area(f.area)} />
                <div className={p.figLabel}>{L(f.label, locale)}</div>
                <div className={p.figValue}>
                  {f.value}
                  {f.unit && <span className={p.figUnit}>{t(`unit.${f.unit}`)}</span>}
                </div>
                <p className={p.figMeasure}>
                  <span className={p.soLabel}>{t('size.measuredBy')}</span>
                  {L(f.measure, locale)}
                </p>
                <Sources ids={f.src} locale={locale} label={srcLabel} />
              </li>
            ))}
          </ul>
          <p className={p.notComparable}>{t('size.notComparable')}</p>
          <h3 className={p.moreTitle}>{t('size.moreTitle')}</h3>
          <ul className={p.moreList}>
            {MORE_FIGURES.map((f) => (
              <li key={f.label.en} className={p.moreItem}>
                <AreaTag area={f.area} label={area(f.area)} />
                <div>
                  {L(f.label, locale)} · <span className={p.moreValue}>{f.value}</span>
                  {f.unit && t(`unit.${f.unit}`)}
                </div>
                <p className={p.figMeasure}>{L(f.measure, locale)}</p>
                <Sources ids={f.src} locale={locale} label={srcLabel} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {standing.has('who') && (
        <Section id="h-who" tone={tone('who')} kicker={t('who.kicker')} title={t('who.title')} desc={t('who.desc')}>
          <div className={p.layers}>
            <div className={p.layer}>
              <h3 className={p.layerTitle}>{t('who.row.ministry')}</h3>
              <ul className={p.layerCells}>
                {AREAS4.map((a) => (
                  <li key={a} className={p.layerCell}>
                    <AreaTag area={a} label={area(a)} />
                    {L(MINISTRIES[a], locale)}
                  </li>
                ))}
              </ul>
            </div>
            {LAYERS.map((row) => (
              <div key={row.key} className={p.layer}>
                <h3 className={p.layerTitle}>{t(`who.row.${row.key}`)}</h3>
                <ul className={p.layerCells}>
                  {AREAS4.map((a) => {
                    const c = row.cells[a];
                    return (
                      <li key={a} className={p.layerCell}>
                        <AreaTag area={a} label={area(a)} />
                        {c ? (
                          <>
                            {L(c.text, locale)}
                            <Sources ids={c.src} locale={locale} label={srcLabel} />
                          </>
                        ) : (
                          <span className={p.none}>{t('noPublicData')}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className={p.so}>
                  <span className={p.soLabel}>{t('who.so')}</span>
                  {L(row.so, locale)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {standing.has('changes') && (
        <Section
          id="h-changes"
          tone={tone('changes')}
          kicker={t('changes.kicker')}
          title={t('changes.title')}
          desc={t('changes.desc')}
        >
          <ol className={p.tl}>
            {TIMELINE.map((it) => (
              <li key={it.date + it.text.en} className={p.tlItem}>
                <span className={p.tlDate}>{it.date}</span>
                <span className={p.tlArea}>
                  <AreaTag area={it.area} label={area(it.area)} />
                  {it.planned && <span className={p.planned}>{t('changes.planned')}</span>}
                </span>
                <div>
                  {L(it.text, locale)}
                  <Sources ids={it.src} locale={locale} label={srcLabel} />
                </div>
              </li>
            ))}
          </ol>
          <p className={p.countLine}>
            {t('changes.count', {
              n: TIMELINE.length,
              list: counts.map((c) => `${area(c.area)} ${c.n}`).join(' · '),
            })}
          </p>
        </Section>
      )}

      {standing.has('gaps') && (
        <Section id="h-gaps" tone={tone('gaps')} kicker={t('gaps.kicker')} title={t('gaps.title')} desc={t('gaps.desc')}>
          <ul className={p.kv}>
            {GAPS.map((g) => (
              <li key={g.label.en} className={p.kvItem}>
                <div>{L(g.label, locale)}</div>
                <div className={p.kvValue}>
                  {g.value ? L(g.value, locale) : <span className={p.none}>{t('noPublicData')}</span>}
                  {g.note && <div className={p.kvNote}>{L(g.note, locale)}</div>}
                  <Sources ids={g.src} locale={locale} label={srcLabel} />
                </div>
              </li>
            ))}
          </ul>
          <p className={v.footnote}>{t('noPublicDataNote')}</p>
        </Section>
      )}

      {standing.has('abroad') && (
        <Section id="h-abroad" tone={tone('abroad')} kicker={t('abroad.kicker')} title={t('abroad.title')} desc={t('abroad.desc')}>
          <ul className={p.countries}>
            {COUNTRIES.map((c) => (
              <li key={c.country.en} className={p.country}>
                <div className={p.countryName}>{L(c.country, locale)}</div>
                <dl className={p.dl}>
                  <dt>{t('abroad.merged')}</dt>
                  <dd>{L(c.merged, locale)}</dd>
                  <dt>{t('abroad.basis')}</dt>
                  <dd>{L(c.basis, locale)}</dd>
                  <dt>{t('abroad.evaluation')}</dt>
                  <dd>{c.evaluation ? L(c.evaluation, locale) : <span className={p.none}>{t('abroad.noEvaluation')}</span>}</dd>
                </dl>
                <Sources ids={c.src} locale={locale} label={srcLabel} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {standing.has('research') && (
        <Section
          id="h-research"
          tone={tone('research')}
          kicker={t('research.kicker')}
          title={t('research.title')}
          desc={t('research.desc')}
        >
          <ul className={p.refs}>
            {RESEARCH.map((r) => (
              <li key={r.cite.en} className={p.ref}>
                <span className={p.refCite}>{L(r.cite, locale)}</span>
                {L(r.text, locale)}
                <Sources ids={r.src} locale={locale} label={srcLabel} />
              </li>
            ))}
          </ul>

          {policyLinks.length > 0 && (
            <>
              <h3 className={p.subTitle}>{t('research.policyCardsTitle')}</h3>
              <ul className={p.cardLinks}>
                {policyLinks.map((x) => (
                  <li key={x.type}>
                    <Link href={hrefOf(x.type, { topic: 'policy', page: 1 })} className={p.cardLink}>
                      <AreaTag type={x.type} label={tt(x.type)} />
                      <span className={p.cardLinkN}>{t('research.policyCards', { n: fmt(x.n) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className={v.footnote}>{t('research.policyRule')}</p>
            </>
          )}

          {themes.length > 0 && (
            <>
              <h3 className={p.subTitle}>{t('research.themesTitle')}</h3>
              <ul className={p.cardLinks}>
                {themes.map((x) => (
                  <li key={x.theme}>
                    <Link href={`/policy-map/research/${x.theme}`} className={p.cardLink}>
                      <span>{t(`theme.${x.theme}`)}</span>
                      <span className={p.cardLinkN}>{t('research.themeCards', { n: fmt(x.n) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className={v.footnote}>{t('research.themeRule')}</p>
            </>
          )}
        </Section>
      )}

      {standing.has('local') && (
        <Section id="h-local" tone={tone('local')} kicker={t('local.kicker')} title={t('local.title')} desc={t('local.desc')}>
          <ul className={p.kv}>
            {LOCAL.map((g) => (
              <li key={g.label.en} className={p.kvItem}>
                <div>{L(g.label, locale)}</div>
                <div className={p.kvValue}>
                  {g.value ? L(g.value, locale) : <span className={p.none}>{t('noPublicData')}</span>}
                  {g.note && <div className={p.kvNote}>{L(g.note, locale)}</div>}
                  <Sources ids={g.src} locale={locale} label={srcLabel} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className={`${v.section} ${v.toneDown}`} aria-label={t('referenceLabel')}>
        <div className={v.inner}>
          <p className={p.reference}>{L(REFERENCE, locale)}</p>
          <p className={p.reference}>
            <Link href="/" className={v.link}>
              {t('backHome')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
