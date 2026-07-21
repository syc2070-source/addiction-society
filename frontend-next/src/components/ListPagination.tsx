import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** 목록 페이지 공용 페이지네이션 — URL searchParams 기반(SEO 친화) */
export default async function ListPagination({
  basePath,
  page,
  totalPages,
  search,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  search?: string;
}) {
  if (totalPages <= 1) return null;
  const tc = await getTranslations('common');

  const href = (p: number) => ({
    pathname: basePath,
    query: { ...(search ? { search } : {}), ...(p > 1 ? { page: p } : {}) },
  });

  return (
    <nav className="pagination" aria-label="Pagination">
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href(page - 1) as any}
        className={page <= 1 ? 'disabled' : undefined}
      >
        {tc('prev')}
      </Link>
      <span>
        {page} / {totalPages}
      </span>
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={href(page + 1) as any}
        className={page >= totalPages ? 'disabled' : undefined}
      >
        {tc('next')}
      </Link>
    </nav>
  );
}
