import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import LocaleSwitch from './LocaleSwitch';

/**
 * 공용 헤더 — 블루프린트 제2장 4그룹 내비.
 */
export default async function SiteHeader() {
  const t = await getTranslations('nav');

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          중독사회
          <small>Addiction Society</small>
        </Link>

        <nav className="site-nav" aria-label="Main">
          <span className="nav-group">
            <span className="nav-group-label">{t('groupData')}</span>
            <Link href="/sources">{t('sources')}</Link>
            <Link href="/calendar">{t('calendar')}</Link>
            <Link href="/indicators">{t('indicators')}</Link>
            <Link href="/timeline">{t('timeline')}</Link>
          </span>
          <span className="nav-group">
            <span className="nav-group-label">{t('groupAnalysis')}</span>
            <Link href="/lab">{t('lab')}</Link>
          </span>
          <span className="nav-group">
            <span className="nav-group-label">{t('groupArchive')}</span>
            <Link href="/policy">{t('policy')}</Link>
            <Link href="/research">{t('research')}</Link>
          </span>
          <span className="nav-group">
            <Link href="/recovery">{t('recovery')}</Link>
          </span>
          {/* 생태계 외부 링크 — 내부 nav와 시각 구분(↗ + 좌측 구분선) */}
          <a
            href="https://addictionnews.net"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-external"
          >
            {t('addictionNews')}
          </a>
        </nav>

        <LocaleSwitch />
      </div>
    </header>
  );
}
