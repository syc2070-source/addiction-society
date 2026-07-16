import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { researchApi, policyApi, recoveryApi } from '../api';

const Home: React.FC = () => {
  const [stats, setStats] = useState({
    research: 0,
    policy: 0,
    recovery: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [researchRes, policyRes, recoveryRes] = await Promise.all([
          researchApi.getStats(),
          policyApi.getStats(),
          recoveryApi.getStats(),
        ]);
        setStats({
          research: researchRes.data.total || 0,
          policy: policyRes.data.total || 0,
          recovery: recoveryRes.data.total || 0,
        });
      } catch (error) {
        console.error('통계 로딩 실패:', error);
      }
    };
    fetchStats();
  }, []);

  // ── 중독 데이터 관측소 카드 데이터 (M0: 하드코딩. M2에서 GET /api/sources/summary 연동 예정) ──
  // 최근 갱신: 실제 확인된 발표일 (임의 변경 금지)
  const recentUpdates = [
    { date: '2026-06-26', label: 'WHO SAFER 진행보고서' },
    { date: '2026-06-26', label: 'UNODC 세계마약보고서 2026' },
    { date: '2026-06-09', label: 'EUDA 유럽마약보고서 2026' },
    { date: '2026-03-27', label: 'NIA 스마트폰 과의존 2025' },
  ];
  // 다음 발표 예정
  const upcomingReleases = [
    { date: '2026-07', label: 'SAMHSA NSDUH' },
    { date: '2026-10', label: '국정감사 자료' },
    { date: '2026-11', label: 'HRI 해악감소 보고서' },
    { date: '미정', label: '정신건강실태조사 (5년 주기)' },
  ];
  // 부처 분산 지도 데이터 (M0: 하드코딩)
  const ministryMap = [
    { type: '알코올·마약(치료)', ministry: '보건복지부', agency: '중독관리통합지원센터 63개소' },
    { type: '도박', ministry: '국무총리실', agency: '사감위 → 한국도박문제예방치유원' },
    { type: '인터넷·스마트폰', ministry: '과학기술정보통신부', agency: '스마트쉼센터' },
    { type: '게임', ministry: '문화체육관광부', agency: '게임과몰입힐링센터' },
    { type: '마약(수사)', ministry: '대검·경찰·관세·해경', agency: '마약범죄 정부합동수사본부' },
    { type: '마약(예방)', ministry: '식품의약품안전처', agency: '한국마약퇴치운동본부' },
  ];

  // 관측소 카드용 인라인 스타일 (App.css 미수정 방침에 따라 인라인 처리)
  const obsBlock: React.CSSProperties = {
    borderTop: '1px dashed rgba(75, 85, 99, 0.8)',
    paddingTop: '12px',
    marginTop: '12px',
  };
  const obsSubtitle: React.CSSProperties = {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#93c5fd',
    marginBottom: '8px',
  };
  const obsRow: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    fontSize: '0.78rem',
    marginBottom: '6px',
  };
  const obsDate: React.CSSProperties = { color: '#9ca3af', flexShrink: 0, minWidth: '82px' };
  const obsLabel: React.CSSProperties = { color: '#e5e7eb' };

  return (
    <>
      {/* Hero 섹션 */}
      <section className="hero">
        <div>
          <div className="badge">
            <div className="badge-dot"></div>
            <span className="badge-label">Project &amp; Platform</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>데이터 기반 중독사회 연구</span>
          </div>
          <h1 className="hero-title">
            중독은 개인의 <span className="highlight">도덕 실패</span>가 아니라,<br />
            사회 전체의 <span className="highlight">구조적 위험 시그널</span>입니다.
          </h1>
          <p className="hero-subtitle">
            <strong>중독사회(Addiction Society)</strong>는 도박·게임·알코올·디지털 중독을
            단순한 개인 문제로 보지 않습니다. 불평등, 금융·플랫폼 산업, 도시·노동 구조, AI까지
            얽혀 있는 <strong>위험 시스템 전체를 데이터로 읽어내고, 치유 공동체의 새로운 표준</strong>을
            제안하는 연구·플랫폼 프로젝트입니다.
          </p>
          <div className="hero-actions">
            <Link to="/policy" className="btn-primary">
              국가별 도박정책 데이터 보기
              <span style={{ fontSize: '1.1rem' }}>↗</span>
            </Link>
            <Link to="/recovery" className="btn-ghost">
              치유 공동체 &amp; AI 플랫폼 비전
            </Link>
          </div>
          <div className="hero-meta">
            1단계: <span>연구·데이터 허브</span> → 2단계: 치유 공동체 네트워크 →
            3단계: <span>AI 기반 상담·정책 실험실</span>
          </div>
        </div>

        {/* Hero 카드 */}
        {/* M0: 하드코딩. M2에서 GET /api/sources/summary 연동 예정 */}
        <aside className="hero-card">
          <div className="hero-card-inner">
            <div className="hero-card-header">
              <div>
                <div className="hero-card-title">중독 데이터 관측소</div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  23개 소스 · 6개 부처 · 4개 국제기구
                </div>
              </div>
              <div className="status-pill">
                <span className="status-dot"></span>
                LIVE
              </div>
            </div>

            {/* 최근 갱신 */}
            <div style={obsBlock}>
              <div style={obsSubtitle}>최근 갱신</div>
              {recentUpdates.map((it) => (
                <div key={it.date + it.label} style={obsRow}>
                  <span style={obsDate}>{it.date}</span>
                  <span style={obsLabel}>{it.label}</span>
                </div>
              ))}
            </div>

            {/* 다음 발표 예정 */}
            <div style={obsBlock}>
              <div style={obsSubtitle}>다음 발표 예정</div>
              {upcomingReleases.map((it) => (
                <div key={it.date + it.label} style={obsRow}>
                  <span style={obsDate}>{it.date}</span>
                  <span style={obsLabel}>{it.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* 문제의식 섹션 */}
      <section className="section">
        <div className="section-header">
          <div className="section-kicker">왜 '중독사회'인가</div>
          <h2 className="section-title">개인의 선택을 넘어, 사회 구조 전체를 읽어야 합니다.</h2>
          <p className="section-desc">
            중독은 흔히 "의지 부족"이나 "도덕성의 문제"로 축소되지만, 실제로는
            <strong> 도시·노동·금융·디지털 플랫폼·정책 실패</strong>까지 얽혀 있는 복합 시스템입니다.
            중독사회 프로젝트는 개인과 사회 구조가 서로를 어떻게 강화하며
            <strong> 위험의 악순환</strong>을 만드는지, 역사·정책·데이터를 통해 추적합니다.
          </p>
        </div>

        <div className="grid-2">
          <div className="card">
            <h3>개인의 위험: 멈출 수 없다는 감각</h3>
            <p>
              도박·게임·알코올·SNS 중독은 모두 "내가 통제하고 있다는 착각"과 "멈추고 싶은데
              멈추지 못하는 경험"을 공유합니다. 이는 단순한 욕구 문제가 아니라,
              <strong> 보상 구조와 알고리즘이 설계된 환경</strong>에서 반복적으로 강화된 결과입니다.
            </p>
            <ul className="bullet-list">
              <li>
                <span className="bullet-dot"></span>
                <span>위험을 감수하도록 설계된 보상 구조(잭팟, 랜덤 박스, 좋아요·알림 등)</span>
              </li>
              <li>
                <span className="bullet-dot"></span>
                <span>불안·외로움·무력감을 잠시 잊게 해주는 즉각적 보상</span>
              </li>
              <li>
                <span className="bullet-dot"></span>
                <span>부채·가정 붕괴·건강 악화 등 삶 전체를 잠식하는 장기 결과</span>
              </li>
            </ul>
          </div>

          <div className="card">
            <h3>구조적 위험: 산업과 정책이 만든 생태계</h3>
            <p>
              중독 산업은 고도의 금융·마케팅·데이터 기술과 결합해 있습니다. 규제는 종종 한 발씩
              늦고, 기업의 이익과 국가 재정, 개인의 삶이 충돌합니다. 중독사회는
              <strong> 정책·규제·세수 구조</strong>까지 포함한 전체 생태계를 하나의 지도로 그리려 합니다.
            </p>
            <ul className="bullet-list">
              <li>
                <span className="bullet-dot"></span>
                <span>국가 재정과 도박 세수가 얽힌 정책 딜레마</span>
              </li>
              <li>
                <span className="bullet-dot"></span>
                <span>플랫폼·모바일 기술이 만든 24시간 접근성</span>
              </li>
              <li>
                <span className="bullet-dot"></span>
                <span>법·규제·감독기관의 파편화와 사각지대</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 통계 섹션 */}
      <section className="section">
        <div className="section-header">
          <div className="section-kicker">데이터 현황</div>
          <h2 className="section-title">중독사회 아카이브</h2>
          <p className="section-desc">
            연구자료, 정책문서, 회복자원을 체계적으로 수집하고 분류합니다.
          </p>
        </div>

        <div className="grid-3">
          <Link to="/research" className="stat-card">
            <span className="stat-number">{stats.research}</span>
            <span className="stat-label">연구자료</span>
          </Link>
          <Link to="/policy" className="stat-card">
            <span className="stat-number">{stats.policy}</span>
            <span className="stat-label">정책문서</span>
          </Link>
          <Link to="/recovery" className="stat-card">
            <span className="stat-number">{stats.recovery}</span>
            <span className="stat-label">회복자원</span>
          </Link>
        </div>
      </section>

      {/* 데이터 & 리포트 섹션 → 부처 분산 지도 */}
      <section className="section">
        <div className="section-header">
          <div className="section-kicker">데이터 &amp; 리포트</div>
          <h2 className="section-title">한국의 중독 대응은 6개 부처로 흩어져 있습니다</h2>
          <p className="section-desc">
            알코올·도박·인터넷·게임·마약 등 중독 유형마다 소관 부처와 집행 기관이 제각각입니다.
          </p>
        </div>

        <div className="card">
          <table className="table-preview" aria-label="중독 유형별 소관 부처 분산 현황">
            <thead>
              <tr>
                <th>중독 유형</th>
                <th>소관 부처</th>
                <th>집행 기관</th>
              </tr>
            </thead>
            <tbody>
              {ministryMap.map((row) => (
                <tr key={row.type}>
                  <td>{row.type}</td>
                  <td>{row.ministry}</td>
                  <td>{row.agency}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 인용구 강조 박스 */}
          <blockquote
            style={{
              margin: '16px 0 0',
              padding: '12px 16px',
              borderLeft: '3px solid #22c55e',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.08)',
              color: '#e5e7eb',
              fontSize: '0.9rem',
            }}
          >
            "부처별 소관 법률이 달라 협력 체계를 구축하기 어렵다"
            <footer style={{ marginTop: '6px', fontSize: '0.78rem', color: '#9ca3af' }}>
              — 보건복지부 관계자, 2025 국정감사
            </footer>
          </blockquote>

          {/* 각주 */}
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '12px' }}>
            법적 근거와 데이터 체계가 달라 정보 공유조차 불가능하며, 청소년 1명을 초기 상담부터
            치료·사후관리까지 연속 지원할 통합 시스템은 부재.
          </p>
        </div>
      </section>

      {/* 비전 섹션 */}
      <section className="section">
        <div className="section-header">
          <div className="section-kicker">치유 공동체 &amp; AI 플랫폼</div>
          <h2 className="section-title">연구를 넘어, 회복을 위한 디지털 치유 공동체로.</h2>
          <p className="section-desc">
            중독사회는 단지 현실을 진단하는 데서 멈추지 않습니다.
            <strong> 지역 커뮤니티·신용 회복·주거·일자리·신앙과 의미 찾기</strong>까지 아우르는
            치유 공동체 모델을 실험하려 합니다.
          </p>
        </div>

        <div className="card">
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-label">Phase 1 · Research Hub</div>
              <div className="timeline-title">데이터 · 리포트 · 정책 비교</div>
              <div className="timeline-desc">
                국가별 도박·중독 정책, 치료 시스템, 재정 구조를 체계적으로 정리하고,
                비교 가능한 지표 체계를 구축합니다.
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-label">Phase 2 · Community Network</div>
              <div className="timeline-title">치유 공동체 네트워크</div>
              <div className="timeline-desc">
                실제 도박·중독 회복 모임, 상담기관, 시민단체, 지역 교회·공동체와 협력하여
                사례와 모형을 축적합니다.
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-label">Phase 3 · AI Support Platform</div>
              <div className="timeline-title">AI 기반 안내 · 자료 추천 · 초기 상담</div>
              <div className="timeline-desc">
                24시간 접근 가능한 AI 안내자·자료 큐레이션·기초 자기 점검 도구를 개발합니다.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;