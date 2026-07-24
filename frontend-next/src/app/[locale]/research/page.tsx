import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchResearch } from '@/lib/api';
import ListPagination from '@/components/ListPagination';

/** 연구자료 목록 (/research) — 카드 + 검색 수준 이식 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'researchPage' });
  return { title: t('title') };
}

export default async function ResearchPage({
  params,
  searchParams,
}: PageProps<'/[locale]/research'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const search = typeof sp.search === 'string' ? sp.search : undefined;
  const page = Math.max(1, parseInt(String(sp.page || '1'), 10) || 1);

  const t = await getTranslations('researchPage');
  const tc = await getTranslations('common');
  const result = await fetchResearch({ page, search });
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
        <p className="status-note">
          {search ? tc('empty') : tc('collectingEmpty')}
        </p>
      ) : (
        <>
          <div className="list-grid">
            {result.data.map((r) => (
              <div key={r.id} className="list-item">
                <div className="list-item-meta">
                  {r.year && <span className="tag">{r.year}</span>}
                  {r.authors && r.authors.length > 0 && (
                    <span>{r.authors.slice(0, 3).join(', ')}</span>
                  )}
                </div>
                <h3 className="list-item-title">{r.title}</h3>
                {(r.summary || r.abstract) && (
                  <p className="list-item-desc">
                    {(r.summary || r.abstract || '').slice(0, 140)}…
                  </p>
                )}
                {r.keywords && r.keywords.length > 0 && (
                  <div className="list-item-meta" style={{ marginTop: 8 }}>
                    {r.keywords.slice(0, 5).map((k) => (
                      <span key={k} className="tag">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                {r.sourceUrl && (
                  <a
                    href={r.sourceUrl}
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
            basePath="/research"
            page={page}
            totalPages={totalPages}
            search={search}
          />
        </>
      )}
    </main>
  );
}
