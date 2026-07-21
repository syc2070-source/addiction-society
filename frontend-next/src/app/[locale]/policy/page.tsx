import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchPolicyDocuments } from '@/lib/api';
import ListPagination from '@/components/ListPagination';

/** 정책문서 목록 (/policy) — 카드 + 검색 수준 이식 (관리자 기능 제외) */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'policyPage' });
  return { title: t('title') };
}

export default async function PolicyPage({
  params,
  searchParams,
}: PageProps<'/[locale]/policy'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const search = typeof sp.search === 'string' ? sp.search : undefined;
  const page = Math.max(1, parseInt(String(sp.page || '1'), 10) || 1);

  const t = await getTranslations('policyPage');
  const tc = await getTranslations('common');
  const result = await fetchPolicyDocuments({ page, search });
  const totalPages = result ? Math.ceil(result.total / result.limit) : 0;

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t('kicker')}</div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-desc">{t('desc')}</p>
      </div>

      <form method="get" className="search-form">
        <input
          type="text"
          name="search"
          className="search-input"
          defaultValue={search}
          placeholder={t('searchPlaceholder')}
        />
        <button type="submit" className="btn-submit">
          {tc('searchButton')}
        </button>
      </form>

      {!result ? (
        <p className="status-note">{tc('unavailable')}</p>
      ) : result.data.length === 0 ? (
        <p className="status-note">{tc('empty')}</p>
      ) : (
        <>
          <div className="list-grid">
            {result.data.map((d) => (
              <div key={d.id} className="list-item">
                <div className="list-item-meta">
                  {d.country && <span className="tag tag-org">{d.country}</span>}
                  {d.year && <span className="tag">{d.year}</span>}
                </div>
                <h3 className="list-item-title">{d.title}</h3>
                {(d.summary || d.description) && (
                  <p className="list-item-desc">
                    {(d.summary || d.description || '').slice(0, 140)}…
                  </p>
                )}
                {d.sourceUrl && (
                  <a
                    href={d.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ext-link"
                  >
                    {tc('viewOriginal')}
                  </a>
                )}
              </div>
            ))}
          </div>
          <ListPagination
            basePath="/policy"
            page={page}
            totalPages={totalPages}
            search={search}
          />
        </>
      )}
    </main>
  );
}
