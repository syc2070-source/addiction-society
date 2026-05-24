import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { policyApi } from '../api';

const PolicyList: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const limit = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: any = { page, limit };
        if (search) params.search = search;
        if (country) params.country = country;

        const response = await policyApi.getDocuments(params);
        setDocuments(response.data.data || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        console.error('정책문서 로딩 실패:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [page, search, country]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Policy Documents</div>
        <h1 className="page-title">정책문서</h1>
        <p className="page-desc">
          국가별 중독 정책 문서와 D×P 매트릭스 분석을 제공합니다.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색: 제목, 국가, 내용"
          />
          <select
            className="filter-select"
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPage(1); }}
          >
            <option value="">국가: 전체</option>
            <option value="KR">한국</option>
            <option value="US">미국</option>
            <option value="UK">영국</option>
            <option value="AU">호주</option>
            <option value="JP">일본</option>
            <option value="EU">유럽연합</option>
          </select>
          <button type="submit" className="btn-primary">검색</button>
        </form>

        {loading ? (
          <p className="loading">로딩 중...</p>
        ) : documents.length === 0 ? (
          <p className="empty">등록된 정책문서가 없습니다.</p>
        ) : (
          <>
            <div className="list-grid">
              {documents.map((item: any) => (
                <Link to={`/policy/${item.id}`} key={item.id} className="list-item">
                  <div className="list-item-meta">
                    {item.country && <span className="tag tag-policy">{item.country}</span>}
                    {item.year && <span>{item.year}</span>}
                  </div>
                  <h3 className="list-item-title">{item.title}</h3>
                  {item.description && (
                    <p className="list-item-desc">
                      {item.description.substring(0, 120)}...
                    </p>
                  )}
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </button>
                <span>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default PolicyList;