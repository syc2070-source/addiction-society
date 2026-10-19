import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import ReviewWindow from './ReviewWindow';

/**
 * 연구자료 검수 창 (/admin/review, SOC-R1).
 * 관문에 걸려 공개에서 숨은 승인분을 오너가 건별로 살리거나 숨긴다.
 * 로그인은 기존 POST /api/auth/login(관리자만) 그대로 쓴다 — 새 관리자 틀 없음.
 * SOC-R9: 오너 도구라 한국어 화면만 둔다 — /en 은 한국어 창으로 가는 안내만(영어 화면 한글 0).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'en' ? 'Research review (admin)' : '연구자료 검수',
    robots: { index: false, follow: false },
  };
}

export default async function AdminReviewPage({
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
          <h1 className="page-title">Research review</h1>
          <p className="page-desc">
            This is the site owner&apos;s review tool and is available in
            Korean only.
          </p>
          <Link href="/admin/review" locale="ko" className="ext-link">
            Open the review tool (Korean)
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">Admin</div>
        <h1 className="page-title">연구자료 검수</h1>
        <p className="page-desc">
          승인됐지만 관련성 관문에 걸려 공개 목록에서 빠진 자료입니다.
          「살림」은 공개 목록에 다시 올리고, 「숨김」은 관문 판정과 무관하게
          숨깁니다. status 는 바뀌지 않습니다.
        </p>
      </div>
      <ReviewWindow
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}
      />
    </main>
  );
}
