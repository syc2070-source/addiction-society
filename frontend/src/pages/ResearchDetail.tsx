import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { researchApi } from '../api';

const DOMAIN_LABELS: Record<string, string> = {
  D0: 'D0 물질중독',
  D1: 'D1 행위중독',
  D2: 'D2 디지털중독',
  D3: 'D3 관계/일중독',
};

const ResearchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [research, setResearch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await researchApi.getOne(Number(id));
        setResearch(response.data);
      } catch (error) {
        console.error('연구자료 로딩 실패:', error);
      }
      setLoading(false);
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return <p className="loading">로딩 중...</p>;
  }

  if (!research) {
    return <p className="empty">연구자료를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="detail-container">
      <Link to="/research" className="back-link">
        ← 목록으로
      </Link>

      <div className="detail-header">
        <div className="section-kicker">Research</div>
        <h1 className="detail-title">{research.title}</h1>
        
        <div className="detail-meta">
          {research.domains?.map((d: string) => (
            <span key={d} className="tag tag-domain">{DOMAIN_LABELS[d] || d}</span>
          ))}
          {research.year && <span className="tag">{research.year}</span>}
          {research.region && <span className="tag">{research.region}</span>}
        </div>
      </div>

      {(research.authors?.length > 0 || research.source) && (
        <div className="detail-content">
          <h3>기본 정보</h3>
          {research.authors?.length > 0 && (
            <p><strong>저자:</strong> {research.authors.join(', ')}</p>
          )}
          {research.source && (
            <p><strong>출처:</strong> {research.source}</p>
          )}
        </div>
      )}

      {research.keywords?.length > 0 && (
        <div className="detail-content">
          <h3>키워드</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {research.keywords.map((k: string) => (
              <span key={k} className="tag">{k}</span>
            ))}
          </div>
        </div>
      )}

      {research.abstract && (
        <div className="detail-content">
          <h3>초록</h3>
          <p>{research.abstract}</p>
        </div>
      )}

      {research.summary && (
        <div className="detail-content">
          <h3>요약</h3>
          <p>{research.summary}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        {research.pdfUrl && (
          <a href={research.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            PDF 보기 ↗
          </a>
        )}
        {research.sourceUrl && (
          <a href={research.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            원문 보기 ↗
          </a>
        )}
      </div>
    </div>
  );
};

export default ResearchDetail;