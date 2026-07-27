import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** 공용 푸터 — 발행처 표기 + 생태계 상호 링크 (블루프린트 제6장) */
export default async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        {/* 푸터는 밝은 면(--bg-alt)이므로 dark-ink 사용. 높이 28px(588:242 → 68×28) */}
        <span className="footer-brand">
          <Image
            src="/logo-dark-ink.png"
            alt="중독사회 addiction society"
            width={68}
            height={28}
          />
          <span>
            © {new Date().getFullYear()} {t('publisher')}
            {' · '}
            <Link href="/about">{t('about')}</Link>
          </span>
        </span>
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
