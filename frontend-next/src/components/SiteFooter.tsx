import { getTranslations } from 'next-intl/server';

/** 공용 푸터 — 생태계 상호 링크 포함 (블루프린트 제6장) */
export default async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>© {new Date().getFullYear()} Addiction Society</span>
        <span className="footer-ecosystem">
          <span className="footer-ecosystem-label">{t('ecosystem')}</span>
          <a
            href="https://addictionnews.net"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('addictionNews')}
          </a>
          <span aria-hidden>·</span>
          {/* lowercase 'statory' 표기 준수 */}
          <a href="https://statory.org" target="_blank" rel="noopener noreferrer">
            statory
          </a>
        </span>
        <span>{t('tagline')}</span>
      </div>
    </footer>
  );
}
