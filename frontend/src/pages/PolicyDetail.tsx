import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { policyApi } from '../api';

const DOMAIN_LABELS: Record<string, string> = {
  D0: '물질중독',
  D1: '행위중독',
  D2: '디지털중독',
  D3: '관계/일중독',
};

const POLICY_LABELS: Record<string, string> = {
  P1: '예방/교육',
  P2: '조기개입',
  P3: '치료/재활',
  P4: '사회복귀',
  P5: '법/규제',
  P6: '재정/인프라',
};

const LABEL_CLASSES: Record<string, string> = {
  strong: 'matrix-cell-strong',
  moderate: 'matrix-cell-moderate',
  weak: 'matrix-cell-weak',
  unclear: 'matrix-cell-unclear',
};

const PolicyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await policyApi.getMatrix(Number(id));
        setData(response.data);
      } catch (error) {
        console.error('정책문서 로딩 실패:', error);
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

  if (!data || !data.document) {
    return <p className="empty">정책문서를 찾을 수 없습니다.</p>;
  }

  const { document, matrix } = data;
  const domains = ['D0', 'D1', 'D2', 'D3'];
  const policies = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  return (
    <div className="detail-container">
      <Link to="/policy" className="back-link">
        ← 목록으로
      </Link>

      <div className="detail-header">
        <div className="section-kicker">Policy Document</div>
        <h1 className="detail-title">{document.title}</h1>

        <div className="detail-meta">
          {document.country && <span className="tag tag-policy">{document.country}</span>}
          {document.year && <span className="tag">{document.year}</span>}
        </div>
      </div>

      {(document.source || document.description) && (
        <div className="detail-content">
          <h3>기본 정보</h3>
          {document.source && (
            <p><strong>출처:</strong> {document.source}</p>
          )}
          {document.description && (
            <p>{document.description}</p>
          )}
        </div>
      )}

      <div className="detail-content">
        <h3>정책 매트릭스 (D×P)</h3>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '16px' }}>
          도메인(D0~D3)과 정책축(P1~P6)에 따른 정책 강도를 시각화합니다.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="matrix-table">
            <thead>
              <tr>
                <th></th>
                {policies.map((p) => (
                  <th key={p}>{POLICY_LABELS[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d}>
                  <td style={{ fontWeight: 600, textAlign: 'left' }}>{DOMAIN_LABELS[d]}</td>
                  {policies.map((p) => {
                    const cell = matrix?.[d]?.[p];
                    const cellClass = cell ? LABEL_CLASSES[cell.label] : '';
                    return (
                      <td
                        key={`${d}-${p}`}
                        className={cellClass}
                        title={cell?.note || ''}
                      >
                        {cell ? cell.label : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="matrix-legend">
          <div className="legend-item">
            <div className="legend-box" style={{ background: 'rgba(34, 197, 94, 0.3)' }}></div>
            <span>strong (강함)</span>
          </div>
          <div className="legend-item">
            <div className="legend-box" style={{ background: 'rgba(245, 158, 11, 0.3)' }}></div>
            <span>moderate (보통)</span>
          </div>
          <div className="legend-item">
            <div className="legend-box" style={{ background: 'rgba(239, 68, 68, 0.3)' }}></div>
            <span>weak (약함)</span>
          </div>
          <div className="legend-item">
            <div className="legend-box" style={{ background: 'rgba(107, 114, 128, 0.3)' }}></div>
            <span>unclear (불명확)</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        {document.pdfUrl && (
          <a href={document.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            PDF 보기 ↗
          </a>
        )}
        {document.sourceUrl && (
          <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            원문 보기 ↗
          </a>
        )}
      </div>
    </div>
  );
};

export default PolicyDetail;