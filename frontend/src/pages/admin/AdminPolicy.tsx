import React, { useEffect, useState } from 'react';
import { policyApi } from '../../api';

interface Policy {
  id: number;
  title: string;
  country?: string;
  year?: number;
  summary?: string;
  sourceUrl?: string;
}

const AdminPolicy: React.FC = () => {
  const [items, setItems] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Policy | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analyzeMessage, setAnalyzeMessage] = useState('');
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectMessage, setCollectMessage] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    country: 'KR',
    year: new Date().getFullYear(),
    summary: '',
    sourceUrl: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await policyApi.getDocuments();
      const data = res.data.data || res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item?: Policy) => {
    if (item) {
      setEditItem(item);
      setFormData({
        title: item.title || '',
        country: item.country || 'KR',
        year: item.year || new Date().getFullYear(),
        summary: item.summary || '',
        sourceUrl: item.sourceUrl || '',
      });
    } else {
      setEditItem(null);
      setFormData({
        title: '',
        country: 'KR',
        year: new Date().getFullYear(),
        summary: '',
        sourceUrl: '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      year: parseInt(String(formData.year)) || null,
    };
    try {
      if (editItem) {
        await policyApi.update(editItem.id, data);
      } else {
        await policyApi.create(data);
      }
      closeModal();
      loadData();
    } catch (err) {
      alert('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await policyApi.delete(id);
      loadData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleAnalyze = async (id: number) => {
    setAnalyzingId(id);
    setAnalyzeMessage('');
    try {
      const res = await policyApi.analyze(id);
      setAnalyzeMessage(`✅ 분석 완료! ${res.data.cellCount}개 셀 생성`);
    } catch (err: any) {
      setAnalyzeMessage(`❌ 분석 실패: ${err.response?.data?.message || err.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAutoCollect = async () => {
    setCollectLoading(true);
    setCollectMessage('');
    try {
      const res = await policyApi.autoCollect();
      const { inserted, skipped, source } = res.data;
      setCollectMessage(
        `🔍 자동 수집 완료: 신규 ${inserted}건, 건너뜀 ${skipped}건 (소스: ${source})`,
      );
      loadData();
    } catch (e: any) {
      setCollectMessage(
        `❌ 자동 수집 실패: ${e.response?.data?.message || e.message}`,
      );
    } finally {
      setCollectLoading(false);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!window.confirm(`${items.length}개 문서를 AI 분석하시겠습니까?`)) return;
    setAnalyzeMessage('전체 분석 시작...');
    let successCount = 0;
    for (const item of items) {
      setAnalyzingId(item.id);
      try {
        await policyApi.analyze(item.id);
        successCount++;
        setAnalyzeMessage(`진행 중... ${successCount}/${items.length}`);
      } catch (err) {
        console.error(`분석 실패 (ID: ${item.id}):`, err);
      }
    }
    setAnalyzingId(null);
    setAnalyzeMessage(`✅ 전체 분석 완료! ${successCount}/${items.length}건 성공`);
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>📋 정책문서 관리</h1>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAutoCollect}
            style={styles.collectBtn}
            disabled={collectLoading || analyzingId !== null}
          >
            {collectLoading ? '수집 중...' : '🔍 자동 수집'}
          </button>
          <button onClick={handleAnalyzeAll} style={styles.analyzeAllBtn} disabled={analyzingId !== null}>
            🤖 전체 AI 분석
          </button>
          <button onClick={() => openModal()} style={styles.addButton}>
            + 새 정책문서
          </button>
        </div>
      </div>

      {collectMessage ? <div style={styles.collectMsg}>{collectMessage}</div> : null}
      {analyzeMessage && <div style={styles.messageBox}>{analyzeMessage}</div>}

      {loading ? (
        <p>로딩 중...</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          <p>등록된 정책문서가 없습니다.</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>제목</th>
              <th style={styles.th}>국가</th>
              <th style={styles.th}>연도</th>
              <th style={styles.th}>작업</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.td}>{item.id}</td>
                <td style={styles.td}>{item.title}</td>
                <td style={styles.td}>{item.country || '-'}</td>
                <td style={styles.td}>{item.year || '-'}</td>
                <td style={styles.td}>
                  <button onClick={() => handleAnalyze(item.id)} style={styles.analyzeBtn} disabled={analyzingId !== null}>
                    {analyzingId === item.id ? '분석중...' : '🤖 AI'}
                  </button>
                  <button onClick={() => openModal(item)} style={styles.editBtn}>수정</button>
                  <button onClick={() => handleDelete(item.id)} style={styles.deleteBtn}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>{editItem ? '정책문서 수정' : '새 정책문서'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>제목 *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} style={styles.input} required />
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>국가</label>
                  <select name="country" value={formData.country} onChange={handleChange} style={styles.input}>
                    <option value="KR">한국</option>
                    <option value="US">미국</option>
                    <option value="UK">영국</option>
                    <option value="JP">일본</option>
                    <option value="EU">유럽연합</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>연도</label>
                  <input type="number" name="year" value={formData.year} onChange={handleChange} style={styles.input} />
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>요약 (AI 분석에 사용)</label>
                <textarea name="summary" value={formData.summary} onChange={handleChange} style={styles.textarea} placeholder="정책 내용을 상세히 작성할수록 AI 분석 정확도가 높아집니다." />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>출처 URL</label>
                <input type="url" name="sourceUrl" value={formData.sourceUrl} onChange={handleChange} style={styles.input} />
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={closeModal} style={styles.cancelBtn}>취소</button>
                <button type="submit" style={styles.submitBtn}>저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { color: '#4fc3f7', margin: 0 },
  addButton: { padding: '12px 24px', backgroundColor: '#4fc3f7', color: '#1a1a2e', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  analyzeAllBtn: { padding: '12px 24px', backgroundColor: '#9c27b0', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  collectBtn: { padding: '12px 20px', backgroundColor: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  collectMsg: { padding: '12px 16px', backgroundColor: '#1a1a2e', borderRadius: '8px', marginBottom: '12px', color: '#81c784', fontSize: '14px' },
  messageBox: { padding: '12px 16px', backgroundColor: '#1a1a2e', borderRadius: '8px', marginBottom: '20px', color: '#4fc3f7' },
  empty: { textAlign: 'center', padding: '60px', color: '#888', backgroundColor: '#16213e', borderRadius: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#16213e', borderRadius: '12px', overflow: 'hidden' },
  th: { backgroundColor: '#0f3460', padding: '16px', textAlign: 'left', color: '#4fc3f7', fontWeight: 600 },
  td: { padding: '14px 16px', borderBottom: '1px solid #3a3a5c' },
  analyzeBtn: { padding: '6px 10px', backgroundColor: '#9c27b0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px', fontSize: '12px' },
  editBtn: { padding: '6px 12px', backgroundColor: '#3a3a5c', color: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#16213e', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { color: '#4fc3f7', marginBottom: '24px' },
  formGroup: { marginBottom: '16px', flex: 1 },
  formRow: { display: 'flex', gap: '16px' },
  label: { display: 'block', marginBottom: '6px', color: '#aaa', fontSize: '14px' },
  input: { width: '100%', padding: '12px', border: '1px solid #3a3a5c', borderRadius: '8px', backgroundColor: '#1a1a2e', color: '#eee', fontSize: '14px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '12px', border: '1px solid #3a3a5c', borderRadius: '8px', backgroundColor: '#1a1a2e', color: '#eee', fontSize: '14px', minHeight: '100px', resize: 'vertical', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
  cancelBtn: { padding: '12px 24px', backgroundColor: '#3a3a5c', color: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  submitBtn: { padding: '12px 24px', backgroundColor: '#4fc3f7', color: '#1a1a2e', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
};

export default AdminPolicy;
