import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import EcoReviewWindow from './EcoReviewWindow';

/**
 * 받은 것 검수 창 (/admin/eco, SOC-R15 ■1 · ■4).
 * ECO-LINK1 받는 문이 들인 Statory 카드 · 중독뉴스 기사를 오너가 살리거나 숨긴다.
 * 받는 문 스위치가 꺼져 있으면 목록이 비어 있다. 오너 도구라 한국어 화면만(/en 은 안내만 · 한글 0).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'en' ? 'Received evidence review (admin)' : '받은 것 검수',
    robots: { index: false, follow: false },
  };
}

export default async function AdminEcoPage({
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
          <h1 className="page-title">Received evidence review</h1>
          <p className="page-desc">
            This is the site owner&apos;s review tool and is available in
            Korean only.
          </p>
          <Link href="/admin/eco" locale="ko" className="ext-link">
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
        <h1 className="page-title">받은 것 검수</h1>
        <p className="page-desc">
          Statory 근거 카드와 중독뉴스 기사가 받는 문으로 들어오면 여기서
          검토합니다. 「살림」한 것만 손님 화면에 섭니다. 같은 논문의 새 판은 앞
          판의 결정을 이어받고, 이어받은 승인에는 「이전 판 승인」 꼬리표가
          붙습니다(손님 화면에는 표시 없음).
        </p>
      </div>
      <EcoReviewWindow
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}
      />
    </main>
  );
}
