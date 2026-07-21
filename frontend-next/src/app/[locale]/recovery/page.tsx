import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchRecoveryResources } from '@/lib/api';
import ListPagination from '@/components/ListPagination';

/** 회복자원 목록 (/recovery) — 카드 + 검색 수준 이식 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'recoveryPage' });
  return { title: t('title') };
}

export default async function RecoveryPage({
  params,
  searchParams,
}: PageProps<'/[locale]/recovery'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const search = typeof sp.search === 'string' ? sp.search : undefined;
  const page = Math.max(1, parseInt(String(sp.page || '1'), 10) || 1);

  const t = await getTranslations('recoveryPage');
  const tc = await getTranslations('common');
  const result = await fetchRecoveryResources({ page, search });
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
            {result.data.map((r) => (
              <div key={r.id} className="list-item">
                <div className="list-item-meta">
                  {r.city && <span className="tag tag-org">{r.city}</span>}
                  {r.type && <span className="tag">{r.type}</span>}
                  {r.isVerified && (
                    <span className="tag" style={{ color: '#22c55e', borderColor: '#22c55e' }}>
                      {t('verified')}
                    </span>
                  )}
                </div>
                <h3 className="list-item-title">{r.name}</h3>
                {r.description && (
                  <p className="list-item-desc">{r.description.slice(0, 120)}</p>
                )}
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {r.address && <span>{r.address}</span>}
                  {r.phone && <span>☎ {r.phone}</span>}
                </div>
                {r.website && (
                  <a
                    href={r.website}
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
            basePath="/recovery"
            page={page}
            totalPages={totalPages}
            search={search}
          />
        </>
      )}
    </main>
  );
}
