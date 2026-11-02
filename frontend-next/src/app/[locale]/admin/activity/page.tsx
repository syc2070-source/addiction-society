import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import ActivityWindow from './ActivityWindow';

/**
 * 운영 로그 (/admin/activity, SOC-R19 ■3) — 홈 v2 에서 빠진 「최근 관측 활동」 · 「지금까지 모은 것」의 운영 쪽.
 * 로그인(관리자)은 검수 창과 같은 POST /api/auth/login. 오너 도구라 한국어만 — /en 은 안내만(영어 화면 한글 0).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'en' ? 'Observatory log (admin)' : '운영 로그',
    robots: { index: false, follow: false },
  };
}

export default async function AdminActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (locale === 'en') {
    return (
      <main className="page-container">
        <div className="page-header">
          <div className="page-kicker">Admin</div>
          <h1 className="page-title">Observatory log</h1>
          <p className="page-desc">
            This is the site owner&apos;s operations log and is available in
            Korean only.
          </p>
          <Link href="/admin/activity" locale="ko" className="ext-link">
            Open the log (Korean)
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">Admin</div>
        <h1 className="page-title">운영 로그</h1>
        <p className="page-desc">
          감시가 남긴 사건 전부(변경 감지 · 차단 · 수동 확인 필요 · 예정일 이월 …)입니다. 손님 홈 v2 에는
          발간 감지와 방송만 나갑니다. 읽기 전용 — 여기서 바꾸는 것은 없습니다.
        </p>
      </div>
      <ActivityWindow
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}
      />
    </main>
  );
}
