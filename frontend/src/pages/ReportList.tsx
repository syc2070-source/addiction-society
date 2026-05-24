import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api';

interface ReportCard {
  id: string;
  title_ko: string;
  summary_ko?: string | null;
  key_findings?: unknown[];
  thumbnail_chart_json?: Record<string, unknown> | null;
  domain?: string | null;
  region?: string | null;
  scope?: string | null;
  engines_count?: number | null;
  sections_count?: number | null;
}

const SCOPE_LABELS: Record<string, string> = {
  global: '글로벌',
  korea_comparison: '한국 비교',
};

const ReportList: React.FC = () => {
  const [reports, setReports] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [domain, setDomain] = useState('');
  const [region, setRegion] = useState('');
  const [scope, setScope] = useState('');
  const limit = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: {
          limit: number;
          offset: number;
          domain?: string;
          region?: string;
          scope?: string;
        } = {
          limit,
          offset: (page - 1) * limit,
        };
        if (domain) params.domain = domain;
        if (region) params.region = region;
        if (scope) params.scope = scope;

        const response = await reportsApi.getAll(params);
        setReports(response.data.items || []);
        setTotal(response.data.count || 0);
      } catch (error) {
        console.error('보고서 로딩 실패:', error);
        setReports([]);
        setTotal(0);
      }
      setLoading(false);
    };

    fetchData();
  }, [page, domain, region, scope]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const truncateSummary = (text: string | null | undefined) => {
    if (!text) return null;
    if (text.length <= 120) return text;
    return `${text.substring(0, 120)}...`;
  };

  const findingLabel = (finding: unknown) => {
    if (typeof finding === 'string') return finding;
    if (finding && typeof finding === 'object' && 'text' in finding) {
      return String((finding as { text: unknown }).text);
    }
    return String(finding);
  };

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Reports</div>
        <h1 className="page-title">보고서</h1>
        <p className="page-desc">
          Statory 중독 시나리오 연구 보고서와 핵심 발견을 제공합니다.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <select
            className="filter-select"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPage(1);
            }}
          >
            <option value="">범위: 전체</option>
            <option value="global">글로벌</option>
            <option value="korea_comparison">한국 비교</option>
          </select>
          <select
            className="filter-select"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setPage(1);
            }}
          >
            <option value="">도메인: 전체</option>
            <option value="D0">D0 물질중독</option>
            <option value="D1">D1 행위중독</option>
            <option value="D2">D2 디지털중독</option>
            <option value="D3">D3 관계/일중독</option>
          </select>
          <select
            className="filter-select"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
            }}
          >
            <option value="">지역: 전체</option>
            <option value="KR">한국</option>
            <option value="US">미국</option>
            <option value="UK">영국</option>
            <option value="AU">호주</option>
            <option value="JP">일본</option>
            <option value="EU">유럽연합</option>
          </select>
          <button type="submit" className="btn-primary">
            적용
          </button>
        </form>

        {loading ? (
          <p className="loading">로딩 중...</p>
        ) : total === 0 || reports.length === 0 ? (
          <p className="empty">등록된 보고서가 없습니다.</p>
        ) : (
          <>
            <div className="list-grid">
              {reports.map((item) => (
                <Link to={`/reports/${item.id}`} key={item.id} className="list-item">
                  <div className="list-item-meta">
                    {item.scope && (
                      <span className="tag tag-policy">
                        {SCOPE_LABELS[item.scope] || item.scope}
                      </span>
                    )}
                    {item.domain && <span className="tag tag-domain">{item.domain}</span>}
                    {item.region && <span>{item.region}</span>}
                    {item.thumbnail_chart_json && (
                      <span className="tag">차트 포함</span>
                    )}
                  </div>
                  <h3 className="list-item-title">{item.title_ko}</h3>
                  {item.summary_ko && (
                    <p className="list-item-desc">{truncateSummary(item.summary_ko)}</p>
                  )}
                  {item.key_findings && item.key_findings.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '0.875rem' }}>
                      {item.key_findings.slice(0, 3).map((finding, idx) => (
                        <li key={idx}>{findingLabel(finding)}</li>
                      ))}
                    </ul>
                  )}
                  {(item.engines_count != null || item.sections_count != null) && (
                    <div className="list-item-meta" style={{ marginTop: '8px' }}>
                      {item.engines_count != null && (
                        <span>엔진 {item.engines_count}</span>
                      )}
                      {item.sections_count != null && (
                        <span>섹션 {item.sections_count}</span>
                      )}
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
      </section>
    </>
  );
};

export default ReportList;
