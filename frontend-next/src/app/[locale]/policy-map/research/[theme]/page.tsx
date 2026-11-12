import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { loadStatoryExport, CARD_TYPES } from '@/lib/statoryEvidence';
import { cardsOfTheme, isTheme, themeCounts } from '@/lib/policyThemes';
import { selfAlternates } from '@/lib/pageMeta';
import CardList from '../../../evidence/CardList';
import { serifKr } from '../../../preview/home/serifFont';
import styles from '../../../preview/home/v3.module.css';
import v from '../../../preview/home/v4.module.css';

/**
 * 정책 쪽 ⑥ 의 주제 쪽 (/policy-map/research/<주제> · SOC-R24 ■3 · 결정 4).
 * 근거 카드 전체(유형 무관 · 「기타」 포함)에서 낱말 규칙으로 고른 카드 — 모델 판정 0.
 * 카드가 있는 주제만 정적으로 만든다(0 이면 404). 같은 카드가 유형 쪽에도 있어 noindex,follow.
 */

type Params = { locale: string; theme: string };

export const dynamicParams = false;

export function generateStaticParams() {
  const loaded = loadStatoryExport();
  const themes = loaded ? themeCounts(loaded.data.cards).map((x) => x.theme) : [];
  return routing.locales.flatMap((locale) => themes.map((theme) => ({ locale, theme })));
}

function themeCards(theme: string) {
  const loaded = loadStatoryExport();
  if (!loaded || !isTheme(theme)) return null;
  // 연도 내림 → approved_at 내림 → card_id (유형 쪽과 같은 차례)
  return cardsOfTheme(loaded.data.cards, theme).sort(
    (a, b) =>
      b.year - a.year ||
      b.approved_at.localeCompare(a.approved_at) ||
      a.card_id.localeCompare(b.card_id),
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, theme } = await params;
  const t = await getTranslations({ locale, namespace: 'policyMap' });
  return {
    title: isTheme(theme) ? `${t(`theme.${theme}`)} · ${t('title')}` : t('title'),
    alternates: selfAlternates(locale, `/policy-map/research/${theme}`),
    robots: { index: false, follow: true },
  };
}

export default async function PolicyThemePage({ params }: { params: Promise<Params> }) {
  const { locale, theme } = await params;
  setRequestLocale(locale);
  const cards = themeCards(theme);
  if (!cards || cards.length === 0 || !isTheme(theme)) notFound();
  const t = await getTranslations('policyMap');
  const fmt = (n: number) => n.toLocaleString(locale);
  const types = new Set(cards.map((c) => CARD_TYPES[c.type]).filter((x) => x !== 'other'));

  return (
    <main className={`${styles.dark} ${styles.page} ${v.page} ${serifKr.variable} blue-preview`}>
      <div className={v.inner}>
        <p>
          <Link href="/policy-map#research" className={styles.darkLink}>
            {t('backToPolicy')}
          </Link>
        </p>
        <div className={styles.kicker} style={{ marginTop: 'var(--space-3)' }}>
          {t('researchKicker')}
        </div>
        <h1 className={styles.title}>{t(`theme.${theme}`)}</h1>
        <p className={styles.lead}>{t('themeCount', { n: fmt(cards.length), types: types.size })}</p>
        <p className={styles.rule}>{t(`themeRule.${theme}`)}</p>
        <CardList cards={cards} locale={locale} hideImplications />
      </div>
    </main>
  );
}
