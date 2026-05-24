import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportsApi } from '../api';

interface ReportSection {
  type?: string;
  title?: string;
  content?: unknown;
  apa_interpretation?: string | null;
}

interface ReportItem {
  id: string;
  title_ko: string;
  summary_ko?: string | null;
  conclusion_ko?: string | null;
  key_findings?: unknown[];
  domain?: string | null;
  region?: string | null;
  scope?: string | null;
  engines_count?: number | null;
  sections_count?: number | null;
  view_count?: number | null;
  published_at?: string | null;
  sections_json?: ReportSection[] | null;
}

const SCOPE_LABELS: Record<string, string> = {
  global: '글로벌',
  korea_comparison: '한국 비교',
};

const findingLabel = (finding: unknown) => {
  if (typeof finding === 'string') return finding;
  if (finding && typeof finding === 'object' && 'text' in finding) {
    return String((finding as { text: unknown }).text);
  }
  return String(finding);
};

const sectionText = (section: ReportSection): string | null => {
  const content = section.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text_ko === 'string') return record.text_ko;
    if (typeof record.text === 'string') return record.text;
  }
  return null;
};

const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await reportsApi.getOne(id as string, true);
        if (response.data.found && response.data.item) {
          setReport(response.data.item);
        } else {
          setReport(null);
        }
      } catch (error) {
        console.error('보고서 로딩 실패:', error);
        setReport(null);
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

  if (!report) {
    return <p className="empty">보고서를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="detail-container">
      <Link to="/reports" className="back-link">
        ← 목록으로
      </Link>

      <div className="detail-header">
        <div className="section-kicker">Report</div>
        <h1 className="detail-title">{report.title_ko}</h1>

        <div className="detail-meta">
          {report.scope && (
            <span className="tag tag-policy">
              {SCOPE_LABELS[report.scope] || report.scope}
            </span>
          )}
          {report.domain && <span className="tag tag-domain">{report.domain}</span>}
          {report.region && <span className="tag">{report.region}</span>}
          {report.engines_count != null && (
            <span className="tag">엔진 {report.engines_count}</span>
          )}
          {report.sections_count != null && (
            <span className="tag">섹션 {report.sections_count}</span>
          )}
          {report.view_count != null && (
            <span className="tag">조회 {report.view_count}</span>
          )}
          {report.published_at && (
            <span className="tag">{report.published_at.slice(0, 10)}</span>
          )}
        </div>
      </div>

      {report.summary_ko && (
        <div className="detail-content">
          <h3>요약</h3>
          <p>{report.summary_ko}</p>
        </div>
      )}

      {report.key_findings && report.key_findings.length > 0 && (
        <div className="detail-content">
          <h3>핵심 발견</h3>
          <ul>
            {report.key_findings.map((finding, idx) => (
              <li key={idx}>{findingLabel(finding)}</li>
            ))}
          </ul>
        </div>
      )}

      {report.conclusion_ko && (
        <div className="detail-content">
          <h3>결론</h3>
          <p>{report.conclusion_ko}</p>
        </div>
      )}

      {report.sections_json && report.sections_json.length > 0 && (
        <>
          {report.sections_json.map((section, idx) => {
            const text = sectionText(section);
            const isChartOrTable =
              section.type === 'chart' || section.type === 'table';

            return (
              <div key={idx} className="detail-content">
                <h3>{section.title || `섹션 ${idx + 1}`}</h3>
                {text && <p>{text}</p>}
                {isChartOrTable && (
                  <p className="empty" style={{ fontSize: '0.875rem' }}>
                    차트·표는 준비 중입니다.
                  </p>
                )}
                {section.apa_interpretation && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {section.apa_interpretation}
                  </p>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default ReportDetail;
