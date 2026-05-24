import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { researchApi } from '../api';

const ResearchList: React.FC = () => {
  const [research, setResearch] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await researchApi.getAll({ page, limit, search });
        setResearch(response.data.data || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        console.error('연구자료 로딩 실패:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="research-list">
      <h2>연구자료</h2>

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색어를 입력하세요"
        />
        <button type="submit">검색</button>
      </form>

      {loading ? (
        <p className="loading">로딩 중...</p>
      ) : research.length === 0 ? (
        <p className="empty">등록된 연구자료가 없습니다.</p>
      ) : (
        <>
          <div className="list">
            {research.map((item: any) => (
              <Link
                to={`/research/${item.id}`}
                key={item.id}
                className="list-item"
              >
                <h3>{item.title}</h3>
                <div className="meta">
                  {item.authors && (
                    <span className="authors">{item.authors.join(', ')}</span>
                  )}
                  {item.year && <span className="year">{item.year}</span>}
                </div>
                {item.domains && item.domains.length > 0 && (
                  <div className="domains">
                    {item.domains.map((d: string) => (
                      <span key={d} className="domain-tag">
                        {d}
                      </span>
                    ))}
                  </div>
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
              <span>
                {page} / {totalPages}
              </span>
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
    </div>
  );
};

export default ResearchList;