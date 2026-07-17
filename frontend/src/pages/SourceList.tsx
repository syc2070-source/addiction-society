import React, { useEffect, useState } from 'react';
import { sourcesApi } from '../api';

// PolicyList.tsx를 클론해 소스 레지스트리용으로 적응한 페이지.
// 레지스트리(23건 소규모)라 서버 페이지네이션 없이 전량 표시한다.

const DOMAIN_LABEL: Record<string, string> = {
  alcohol: '알코올',
  drug: '마약',
  gambling: '도박',
  digital: '디지털',
  tobacco: '담배',
  policy: '정책',
  multi: '종합',
};
const SCOPE_LABEL: Record<string, string> = {
  global: '국제',
  regional: '지역',
  korea: '한국',
};
const CADENCE_LABEL: Record<string, string> = {
  monthly: '월간',
  quarterly: '분기',
  annual: '연간',
  biennial: '격년',
  quinquennial: '5년',
  irregular: '비정기',
};

// 신뢰도 뱃지 색: 1=1차(그린) 2=기관2차(블루) 3=언론(회색)
const reliabilityBadge = (r: number | null) => {
  if (r === 1) return { label: '1차 소스', color: '#22c55e' };
  if (r === 2) return { label: '기관 2차', color: '#60a5fa' };
  if (r === 3) return { label: '언론', color: '#9ca3af' };
  return null;
};

const SourceList: React.FC = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [scope, setScope] = useState('');
  const [cadence, setCadence] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: any = {};
        if (search) params.search = search;
        if (domain) params.domain = domain;
        if (scope) params.scope = scope;
        if (cadence) params.cadence = cadence;

        const res = await sourcesApi.getAll(params);
        setSources(res.data.data || []);
        setTotal(res.data.total || 0);
      } catch (error) {
        console.error('소스 로딩 실패:', error);
      }
      setLoading(false);
    };
    fetchData();
  }, [search, domain, scope, cadence]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Data Sources</div>
        <h1 className="page-title">데이터 관측소 · 소스 레지스트리</h1>
        <p className="page-desc">
          국제·미국·한국 기관의 중독 관련 정기 발간물 {total}건을 추적합니다.
          발간 임박순으로 정렬됩니다.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색: 제목, 기관"
          />
          <select
            className="filter-select"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            <option value="">도메인: 전체</option>
            <option value="alcohol">알코올</option>
            <option value="drug">마약</option>
            <option value="gambling">도박</option>
            <option value="digital">디지털</option>
            <option value="policy">정책</option>
          </select>
          <select
            className="filter-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="">범위: 전체</option>
            <option value="intl">국제</option>
            <option value="korea">한국</option>
          </select>
          <select
            className="filter-select"
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            <option value="">주기: 전체</option>
            <option value="monthly">월간</option>
            <option value="quarterly">분기</option>
            <option value="annual">연간</option>
            <option value="biennial">격년</option>
            <option value="quinquennial">5년</option>
            <option value="irregular">비정기</option>
          </select>
        </form>

        {loading ? (
          <p className="loading">로딩 중...</p>
        ) : sources.length === 0 ? (
          <p className="empty">조건에 맞는 소스가 없습니다.</p>
        ) : (
          <div className="list-grid">
            {sources.map((s: any) => {
              const stale = s.status === 'stale';
              const rb = reliabilityBadge(s.reliability);
              return (
                <div
                  key={s.id}
                  className="list-item"
                  style={stale ? { opacity: 0.55 } : undefined}
                >
                  <div className="list-item-meta">
                    <span className="tag tag-policy">{s.orgKo || s.org}</span>
                    {s.domain && (
                      <span className="tag">
                        {DOMAIN_LABEL[s.domain] || s.domain}
                      </span>
                    )}
                    {s.scope && (
                      <span className="tag">{SCOPE_LABEL[s.scope] || s.scope}</span>
                    )}
                    {s.cadence && (
                      <span className="tag">
                        {CADENCE_LABEL[s.cadence] || s.cadence}
                      </span>
                    )}
                    {rb && (
                      <span
                        className="tag"
                        style={{ color: rb.color, borderColor: rb.color }}
                      >
                        {rb.label}
                      </span>
                    )}
                    {stale && (
                      <span
                        className="tag"
                        style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                      >
                        갱신 지연
                      </span>
                    )}
                  </div>

                  <h3 className="list-item-title">{s.titleKo}</h3>
                  {s.titleEn && (
                    <p
                      className="list-item-desc"
                      style={{ marginTop: 0, opacity: 0.7 }}
                    >
                      {s.titleEn}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap',
                      fontSize: '0.82rem',
                      color: '#aeb9cc',
                      margin: '8px 0',
                    }}
                  >
                    <span>
                      최근 발표:{' '}
                      <strong style={{ color: '#eef2f9' }}>
                        {s.lastPublishedAt || '수집 중'}
                      </strong>
                    </span>
                    <span>
                      다음 예정:{' '}
                      <strong style={{ color: '#eef2f9' }}>
                        {s.nextExpectedAt || '—'}
                      </strong>
                    </span>
                  </div>

                  {s.license && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: '#8b97ad',
                        margin: '4px 0',
                      }}
                    >
                      라이선스: {s.license}
                    </p>
                  )}

                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '6px',
                      fontSize: '0.85rem',
                      color: '#60a5fa',
                    }}
                  >
                    원본 보기 ↗
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

export default SourceList;
