import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ReviewWindow from './ReviewWindow';

/**
 * 연구자료 검수 창 (/admin/review, SOC-R1).
 * 관문에 걸려 공개에서 숨은 승인분을 오너가 건별로 살리거나 숨긴다.
 * 로그인은 기존 POST /api/auth/login(관리자만) 그대로 쓴다 — 새 관리자 틀 없음.
 */
export const metadata: Metadata = {
  title: '연구자료 검수',
  robots: { index: false, follow: false },
};

export default async function AdminReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
