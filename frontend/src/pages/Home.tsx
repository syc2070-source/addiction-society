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
        <aside className="hero-card">
          <div className="hero-card-inner">
            <div className="hero-card-header">
              <div>
                <div className="hero-card-title">Global Gambling Governance</div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  12개국 도박중독 정책 비교 · 지표 프레임워크 파일럿
                </div>
              </div>
              <div className="status-pill">
                <span className="status-dot"></span>
                v1.0 데이터 파일럿
              </div>
            </div>

            <div className="hero-card-grid">
              <div className="metric-card">
                <div className="metric-label">
                  정책 강도 지수(0–100) <span className="badge badge-example">예시</span>
                </div>
                <div className="metric-value">73.4</div>
                <div className="metric-sub">
                  광고 규제, 한도 정책, 자기배제 시스템, 치료 접근성 등을
                  통합한 <strong>종합 지표</strong>의 예시 값입니다.
                </div>
                <div className="metric-pill-row">
                  <span className="metric-pill">광고 규제 · 0.82</span>
                  <span className="metric-pill">베팅한도 · 0.76</span>
                  <span className="metric-pill">데이터 접근권 · 0.68</span>
                </div>
              </div>
              <div className="mini-chart">
                도박 관련 검색·매출·치료 수요의<br />장기 추세(예시)
                <div className="mini-chart-bars">
                  <div className="mini-bar"></div>
                  <div className="mini-bar"></div>
                  <div className="mini-bar"></div>
                  <div className="mini-bar"></div>
                </div>
                <div className="mini-chart-labels">
                  <span>2020</span>
                  <span>2021</span>
                  <span>2023</span>
                  <span>2025</span>
                </div>
              </div>
            </div>

            <div className="hero-card-footer">
              <span>
                현재: <strong>한국·미국·영국·호주 등 12개국</strong> 정책·지표 데이터셋 정비 중
              </span>
              <span className="hero-card-tag">향후 확장: 분석·시각화 엔진 연동</span>
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

      {/* 데이터 & 리포트 섹션 */}
      <section className="section">
        <div className="section-header">
          <div className="section-kicker">데이터 &amp; 리포트</div>
          <h2 className="section-title">12개국 도박중독 거버넌스 데이터 허브(예시 구조)</h2>
          <p className="section-desc">
            중독사회 웹은 <strong>국가별 도박 규제·중독 예방·치료 접근성</strong>을 비교 분석하는
            데이터 허브가 됩니다. 아래는 실제 구현될 지표 구조의 예시입니다.
          </p>
        </div>

        <div className="card">
          <div className="pill-row">
            <span className="pill">광고 제한 수준</span>
            <span className="pill">베팅·입장 한도</span>
            <span className="pill">자기배제·모니터링 시스템</span>
            <span className="pill">상담·치료 접근성</span>
            <span className="pill">세수 활용·사회 환원</span>
          </div>

          <table className="table-preview">
            <thead>
              <tr>
                <th>국가</th>
                <th>광고 제한</th>
                <th>한도 정책</th>
                <th>치료 접근성</th>
                <th>종합 점수</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>영국(UK)</td>
                <td>높음</td>
                <td>중간</td>
                <td>높음</td>
                <td>78</td>
              </tr>
              <tr>
                <td>호주(AU)</td>
                <td>중간</td>
                <td>높음</td>
                <td>중간</td>
                <td>74</td>
              </tr>
              <tr>
                <td>한국(KR)</td>
                <td>중간</td>
                <td>중간</td>
                <td>중간</td>
                <td>68</td>
              </tr>
              <tr>
                <td>미국(US)</td>
                <td>낮음</td>
                <td>낮음</td>
                <td>지역별 차이 큼</td>
                <td>62</td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '8px' }}>
            ※ 위 값은 예시이며, 실제 서비스에서는 연도별 추세, 군집 분석, 민감도 분석을 포함한
            <strong> 대화형 대시보드</strong>로 제공될 예정입니다.
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