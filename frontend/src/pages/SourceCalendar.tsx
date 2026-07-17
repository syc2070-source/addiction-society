import React, { useEffect, useState } from 'react';
import { sourcesApi } from '../api';

// 발표 캘린더: GET /api/sources/calendar(예정)를 월별로 그룹핑하고,
// next_expected_at이 null인 소스는 하단 "미정" 그룹으로 별도 표시.

// 범위 뱃지: 데이터의 scope는 global|regional|korea.
// (인수인계서의 '미국'은 regional에 EU도 포함되므로 '지역'으로 표기)
const SCOPE_LABEL: Record<string, string> = {
  korea: '한국',
  global: '국제',
  regional: '지역',
};

const monthKo = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
};

const groupHeading: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#93c5fd',
  margin: '0 0 12px',
  letterSpacing: '0.02em',
};

const SourceCalendar: React.FC = () => {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [undated, setUndated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cal, all] = await Promise.all([
          sourcesApi.getCalendar(), // 예정(next_expected_at NOT NULL, 임박순)
          sourcesApi.getAll(), // 미정 그룹 도출용 전체
        ]);
        setScheduled(cal.data || []);
        const list = all.data.data || [];
        setUndated(list.filter((s: any) => !s.nextExpectedAt));
      } catch (error) {
        console.error('캘린더 로딩 실패:', error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // ★ 기사화 우선순위: 1차 소스 AND 한국
  const isStar = (s: any) => s.reliability === 1 && s.scope === 'korea';

  // 예정 소스를 월(YYYY-MM)별로 그룹핑
  const groups: Record<string, any[]> = {};
  scheduled.forEach((s) => {
    const key = String(s.nextExpectedAt || '').slice(0, 7);
    (groups[key] ??= []).push(s);
  });
  const monthKeys = Object.keys(groups).sort();

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Publication Calendar</div>
        <h1 className="page-title">발표 캘린더</h1>
        <p className="page-desc">
          다음 발표가 예정된 소스를 월별로 정리합니다. ★는 기사화 우선순위(한국·1차 소스)입니다.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        {loading ? (
          <p className="loading">로딩 중...</p>
        ) : monthKeys.length === 0 && undated.length === 0 ? (
          <p className="empty">수집 중</p>
        ) : (
          <>
            {monthKeys.map((mk) => (
              <div key={mk} style={{ marginBottom: '24px' }}>
                <h2 style={groupHeading}>{monthKo(mk)}</h2>
                <div className="list-grid">
                  {groups[mk].map((s) => (
                    <div key={s.id} className="list-item">
                      <div className="list-item-meta">
                        <span className="tag tag-policy">{s.orgKo || s.org}</span>
                        <span className="tag">
                          {SCOPE_LABEL[s.scope] || s.scope}
                        </span>
                        {isStar(s) && (
                          <span
                            className="tag"
                            style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                          >
                            ★ 기사화 우선
                          </span>
                        )}
                      </div>
                      <h3 className="list-item-title">
                        {isStar(s) ? '★ ' : ''}
                        {s.titleKo}
                      </h3>
                      <p className="list-item-desc" style={{ margin: 0 }}>
                        {String(s.nextExpectedAt).slice(0, 7)} 예정 · {s.titleEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 미정 그룹 (next_expected_at null — irregular 및 발표시점 미상) */}
            {undated.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h2 style={groupHeading}>발표 예정 미정</h2>
                <div className="list-grid">
                  {undated.map((s) => (
                    <div
                      key={s.id}
                      className="list-item"
                      style={{ opacity: 0.75 }}
                    >
                      <div className="list-item-meta">
                        <span className="tag tag-policy">{s.orgKo || s.org}</span>
                        <span className="tag">
                          {SCOPE_LABEL[s.scope] || s.scope}
                        </span>
                        <span className="tag">
                          {s.cadence === 'irregular' ? '비정기' : '수집 중'}
                        </span>
                        {isStar(s) && (
                          <span
                            className="tag"
                            style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                          >
                            ★
                          </span>
                        )}
                      </div>
                      <h3 className="list-item-title">
                        {isStar(s) ? '★ ' : ''}
                        {s.titleKo}
                      </h3>
                      <p className="list-item-desc" style={{ margin: 0 }}>
                        발표 시점 미정
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default SourceCalendar;
