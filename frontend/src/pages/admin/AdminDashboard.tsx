import React, { useEffect, useState } from 'react';
import { researchApi, policyApi, recoveryApi, tagsApi } from '../../api';

// 샘플 데이터 - 백엔드 DTO에 맞춤
const sampleResearch = [
  {
    title: "한국 청소년 인터넷 게임 중독 실태 및 영향요인 연구",
    authors: ["김철수", "이영희"],
    year: 2024,
    abstract: "본 연구는 한국 청소년의 인터넷 게임 중독 실태를 파악하고, 개인적·환경적 영향요인을 분석하였다.",
    summary: "청소년 게임 중독 고위험군 5.2%, 자기통제력이 핵심 보호요인",
    region: "KR",
    keywords: ["게임중독", "청소년", "자기통제력", "부모양육"],
  },
  {
    title: "알코올 사용 장애의 신경생물학적 기전과 치료적 접근",
    authors: ["박지훈", "최민수", "정유진"],
    year: 2023,
    abstract: "알코올 사용 장애(AUD)의 신경생물학적 기전을 체계적으로 고찰하고, 최신 치료 접근법을 검토하였다.",
    summary: "AUD 치료에 날트렉손+CBT 병합요법 효과적",
    region: "KR",
    keywords: ["알코올중독", "신경생물학", "날트렉손", "인지행동치료"],
  },
  {
    title: "Smartphone Addiction and Mental Health: A Meta-Analysis",
    authors: ["Smith J", "Johnson M"],
    year: 2024,
    abstract: "This meta-analysis examined the relationship between smartphone addiction and mental health outcomes.",
    summary: "스마트폰 중독은 우울, 불안, 수면문제와 유의한 상관관계",
    region: "US",
    keywords: ["스마트폰중독", "정신건강", "우울", "메타분석"],
  },
  {
    title: "도박 중독자의 회복 과정에 관한 질적 연구",
    authors: ["이민아", "김준호"],
    year: 2023,
    abstract: "본 연구는 도박 중독에서 회복 중인 12명의 경험을 심층 면담을 통해 분석하였다.",
    summary: "도박 중독 회복에 자조모임과 가족 지지가 핵심",
    region: "KR",
    keywords: ["도박중독", "회복", "자조모임", "질적연구"],
  },
  {
    title: "AI 챗봇 과의존 현상과 심리적 특성 연구",
    authors: ["정현우", "박소영"],
    year: 2025,
    abstract: "AI 챗봇 사용자 500명을 대상으로 과의존 실태와 심리적 특성을 조사하였다.",
    summary: "AI 챗봇 과의존 12.4%, 외로움과 사회불안이 위험요인",
    region: "KR",
    keywords: ["AI중독", "챗봇", "외로움", "사회불안"],
  },
];

const samplePolicy = [
  { title: "제2차 도박문제 예방·치유 종합계획 (2024-2028)", country: "KR", year: 2024, summary: "불법도박 근절, 예방교육 강화, 치유인프라 확충을 3대 목표로 설정." },
  { title: "게임산업진흥에 관한 법률 일부개정법률안", country: "KR", year: 2024, summary: "게임 과몰입 예방을 위한 자율규제 체계 강화." },
  { title: "National Drug Control Strategy 2024", country: "US", year: 2024, summary: "오피오이드 위기 대응을 최우선 과제로 설정." },
  { title: "Gambling Act 2024 Amendment", country: "UK", year: 2024, summary: "온라인 도박 규제 강화." },
  { title: "EU Digital Services Act - 중독성 디자인 규제", country: "EU", year: 2023, summary: "플랫폼의 중독성 디자인 패턴 규제." },
];

const sampleRecovery = [
  { name: "한국도박문제예방치유원", type: "counseling", city: "서울", address: "서울특별시 강남구 테헤란로 123", phone: "1336", operatingHours: "24시간 상담 가능", website: "https://www.kcgp.or.kr", description: "도박문제 예방 및 치유 전문기관." },
  { name: "알코올중독 상담전화", type: "hotline", city: "전국", phone: "1577-0199", operatingHours: "24시간", description: "알코올 관련 문제 무료 전화상담." },
  { name: "게임과몰입힐링센터", type: "counseling", city: "부산", address: "부산광역시 해운대구 센텀중앙로 55", phone: "051-123-4567", operatingHours: "평일 09:00-18:00", description: "게임 과몰입 청소년 및 성인 대상 상담." },
  { name: "단도박 익명모임 (GA Korea)", type: "self_help", city: "서울", address: "서울시 마포구 도화동", phone: "02-555-1234", operatingHours: "매주 토요일 14:00", description: "도박 중독 회복을 위한 12단계 자조모임." },
  { name: "스마트쉼센터", type: "counseling", city: "서울", address: "서울특별시 중구 세종대로 110", phone: "1599-0075", operatingHours: "평일 09:00-18:00", description: "인터넷·스마트폰 과의존 예방 및 상담." },
];

const sampleTags = [
  { name: "알코올", type: "topic" },
  { name: "도박", type: "topic" },
  { name: "게임", type: "topic" },
  { name: "스마트폰", type: "topic" },
  { name: "AI", type: "topic" },
  { name: "약물", type: "topic" },
  { name: "SNS", type: "topic" },
  { name: "예방", type: "policy" },
  { name: "치료", type: "policy" },
  { name: "규제", type: "policy" },
  { name: "재활", type: "policy" },
  { name: "청소년", type: "topic" },
];

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ research: 0, policy: 0, recovery: 0, tags: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [researchRes, policyRes, recoveryRes, tagsRes] = await Promise.all([
        researchApi.getAll(),
        policyApi.getDocuments(),
        recoveryApi.getResources(),
        tagsApi.getAll(),
      ]);
      setStats({
        research: researchRes.data.data?.length || researchRes.data.total || 0,
        policy: policyRes.data.data?.length || policyRes.data.total || 0,
        recovery: recoveryRes.data.data?.length || recoveryRes.data.total || 0,
        tags: Array.isArray(tagsRes.data) ? tagsRes.data.length : 0,
      });
    } catch (err) {
      console.error('통계 로드 실패:', err);
    }
  };

  const insertSampleData = async (type: 'research' | 'policy' | 'recovery' | 'tags' | 'all') => {
    setLoading(true);
    setMessage('');
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    try {
      // 기존 데이터 조회 (중복 체크용)
      const [existingTags, existingResearch, existingPolicy, existingRecovery] = await Promise.all([
        tagsApi.getAll().then(r => r.data).catch(() => []),
        researchApi.getAll().then(r => r.data.data || r.data || []).catch(() => []),
        policyApi.getDocuments().then(r => r.data.data || r.data || []).catch(() => []),
        recoveryApi.getResources().then(r => r.data.data || r.data || []).catch(() => []),
      ]);

      const existingTagNames = new Set((existingTags as any[]).map((t: any) => t.name));
      const existingResearchTitles = new Set((existingResearch as any[]).map((r: any) => r.title));
      const existingPolicyTitles = new Set((existingPolicy as any[]).map((p: any) => p.title));
      const existingRecoveryNames = new Set((existingRecovery as any[]).map((r: any) => r.name));

      // 태그 입력
      if (type === 'tags' || type === 'all') {
        for (const item of sampleTags) {
          if (existingTagNames.has(item.name)) {
            skipCount++;
            continue;
          }
          try {
            await tagsApi.create(item);
            successCount++;
          } catch (e: any) {
            failCount++;
            console.error('태그 입력 실패:', item.name, e.response?.data || e.message);
          }
        }
      }

      // 연구자료 입력
      if (type === 'research' || type === 'all') {
        for (const item of sampleResearch) {
          if (existingResearchTitles.has(item.title)) {
            skipCount++;
            continue;
          }
          try {
            await researchApi.create(item);
            successCount++;
          } catch (e: any) {
            failCount++;
            console.error('연구자료 입력 실패:', item.title, e.response?.data || e.message);
          }
        }
      }

      // 정책문서 입력
      if (type === 'policy' || type === 'all') {
        for (const item of samplePolicy) {
          if (existingPolicyTitles.has(item.title)) {
            skipCount++;
            continue;
          }
          try {
            await policyApi.create(item);
            successCount++;
          } catch (e: any) {
            failCount++;
            console.error('정책문서 입력 실패:', item.title, e.response?.data || e.message);
          }
        }
      }

      // 회복자원 입력
      if (type === 'recovery' || type === 'all') {
        for (const item of sampleRecovery) {
          if (existingRecoveryNames.has(item.name)) {
            skipCount++;
            continue;
          }
          try {
            await recoveryApi.create(item);
            successCount++;
          } catch (e: any) {
            failCount++;
            console.error('회복자원 입력 실패:', item.name, e.response?.data || e.message);
          }
        }
      }

      // 결과 메시지
      const parts = [];
      if (successCount > 0) parts.push(`✅ ${successCount}건 성공`);
      if (skipCount > 0) parts.push(`⏭️ ${skipCount}건 이미 존재`);
      if (failCount > 0) parts.push(`❌ ${failCount}건 실패`);
      setMessage(parts.join(', ') || '변경 없음');

      loadStats();
    } catch (err) {
      setMessage('❌ 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={styles.title}>📊 대시보드</h1>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}><h3 style={styles.statLabel}>연구자료</h3><div style={styles.statNumber}>{stats.research}</div></div>
        <div style={styles.statCard}><h3 style={styles.statLabel}>정책문서</h3><div style={styles.statNumber}>{stats.policy}</div></div>
        <div style={styles.statCard}><h3 style={styles.statLabel}>회복자원</h3><div style={styles.statNumber}>{stats.recovery}</div></div>
        <div style={styles.statCard}><h3 style={styles.statLabel}>태그</h3><div style={styles.statNumber}>{stats.tags}</div></div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🚀 샘플 데이터 입력</h2>
        <p style={styles.sectionDesc}>
          테스트용 샘플을 넣습니다. 제목·이름이 같으면 건너뜁니다. 원격 피드는 연구/정책 관리 화면의 🔍 자동 수집과 백엔드 스케줄러에서 처리합니다.
        </p>

        <div style={styles.buttonGroup}>
          <button onClick={() => insertSampleData('all')} style={{ ...styles.button, ...styles.buttonPrimary }} disabled={loading}>
            {loading ? '입력 중...' : '🎯 전체 샘플 입력'}
          </button>
          <button onClick={() => insertSampleData('tags')} style={styles.button} disabled={loading}>태그 (12건)</button>
          <button onClick={() => insertSampleData('research')} style={styles.button} disabled={loading}>연구자료 (5건)</button>
          <button onClick={() => insertSampleData('policy')} style={styles.button} disabled={loading}>정책문서 (5건)</button>
          <button onClick={() => insertSampleData('recovery')} style={styles.button} disabled={loading}>회복자원 (5건)</button>
        </div>

        {message && <p style={styles.message}>{message}</p>}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  title: { color: '#4fc3f7', marginBottom: '30px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' },
  statCard: { backgroundColor: '#16213e', padding: '24px', borderRadius: '12px', textAlign: 'center' },
  statLabel: { color: '#888', fontSize: '14px', marginBottom: '8px', fontWeight: 'normal' },
  statNumber: { fontSize: '36px', fontWeight: 'bold', color: '#4fc3f7' },
  section: { backgroundColor: '#16213e', padding: '24px', borderRadius: '12px' },
  sectionTitle: { color: '#4fc3f7', marginBottom: '8px', fontSize: '18px' },
  sectionDesc: { color: '#888', marginBottom: '20px', fontSize: '14px' },
  buttonGroup: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  button: { padding: '12px 20px', backgroundColor: '#3a3a5c', color: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  buttonPrimary: { backgroundColor: '#9c27b0', color: 'white', fontWeight: 'bold' },
  message: { marginTop: '20px', padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', color: '#4fc3f7' },
};

export default AdminDashboard;
