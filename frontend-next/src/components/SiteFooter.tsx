import { getTranslations } from 'next-intl/server';

/** 공용 푸터 */
export default async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>© {new Date().getFullYear()} Addiction Society</span>
        <span>{t('tagline')}</span>
      </div>
    </footer>
  );
}
