'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

/** 현재 페이지를 유지한 채 ko ↔ en 전환 (클라이언트 — 현재 경로 필요) */
export default function LocaleSwitch() {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <nav className="locale-switch" aria-label="Language">
      <Link
        href={pathname}
        locale="ko"
        className={locale === 'ko' ? 'active' : undefined}
      >
        한국어
      </Link>
      <span aria-hidden>·</span>
      <Link
        href={pathname}
        locale="en"
        className={locale === 'en' ? 'active' : undefined}
      >
        English
      </Link>
    </nav>
  );
}
