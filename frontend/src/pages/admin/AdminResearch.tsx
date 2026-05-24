import React, { useEffect, useState } from 'react';
import { researchApi } from '../../api';

interface Research {
  id: number;
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  summary?: string;
  region?: string;
  sourceUrl?: string;
  keywords?: string[];
}

const AdminResearch: React.FC = () => {
  const [items, setItems] = useState<Research[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Research | null>(null);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectMessage, setCollectMessage] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: new Date().getFullYear(),
    abstract: '',
    summary: '',
    region: 'KR',
    sourceUrl: '',
    keywords: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await researchApi.getAll();
      const data = res.data.data || res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item?: Research) => {
    if (item) {
      setEditItem(item);
      setFormData({
        title: item.title || '',
        authors: item.authors || '',
        year: item.year || new Date().getFullYear(),
        abstract: item.abstract || '',
        summary: item.summary || '',
        region: item.region || 'KR',
        sourceUrl: item.sourceUrl || '',
        keywords: (item.keywords || []).join(', '),
      });
    } else {
      setEditItem(null);
      setFormData({
        title: '',
        authors: '',
        year: new Date().getFullYear(),
        abstract: '',
        summary: '',
        region: 'KR',
        sourceUrl: '',
        keywords: '',
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
      keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
    };

    try {
      if (editItem) {
        await researchApi.update(editItem.id, data);
      } else {
        await researchApi.create(data);
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
      await researchApi.delete(id);
      loadData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleAutoCollect = async () => {
    setCollectLoading(true);
    setCollectMessage('');
    try {
      const res = await researchApi.autoCollect();
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

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>📄 연구자료 관리</h1>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAutoCollect}
            style={styles.collectBtn}
            disabled={collectLoading}
          >
            {collectLoading ? '수집 중...' : '🔍 자동 수집'}
          </button>
          <button onClick={() => openModal()} style={styles.addButton}>
            + 새 연구자료
          </button>
        </div>
      </div>

      {collectMessage ? <p style={styles.collectMsg}>{collectMessage}</p> : null}

      {loading ? (
        <p>로딩 중...</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          <p>등록된 연구자료가 없습니다.</p>
          <p>대시보드에서 샘플 데이터를 입력하거나, 새로 추가하세요.</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>제목</th>
              <th style={styles.th}>저자</th>
              <th style={styles.th}>연도</th>
              <th style={styles.th}>지역</th>
              <th style={styles.th}>작업</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.td}>{item.id}</td>
                <td style={styles.td}>{item.title}</td>
                <td style={styles.td}>{item.authors || '-'}</td>
                <td style={styles.td}>{item.year || '-'}</td>
                <td style={styles.td}>{item.region || '-'}</td>
                <td style={styles.td}>
                  <button onClick={() => openModal(item)} style={styles.editBtn}>
                    수정
                  </button>
                  <button onClick={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 모달 */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>
              {editItem ? '연구자료 수정' : '새 연구자료'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>제목 *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>저자</label>
                  <input
                    type="text"
                    name="authors"
                    value={formData.authors}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="저자1, 저자2"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>연도</label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>초록</label>
                <textarea
                  name="abstract"
                  value={formData.abstract}
                  onChange={handleChange}
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>요약</label>
                <textarea
                  name="summary"
                  value={formData.summary}
                  onChange={handleChange}
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>지역</label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    style={styles.input}
                  >
                    <option value="KR">한국</option>
                    <option value="US">미국</option>
                    <option value="EU">유럽</option>
                    <option value="AS">아시아</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>출처 URL</label>
                  <input
                    type="url"
                    name="sourceUrl"
                    value={formData.sourceUrl}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>키워드 (쉼표 구분)</label>
                <input
                  type="text"
                  name="keywords"
                  value={formData.keywords}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="알코올, 청소년, 예방"
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={closeModal} style={styles.cancelBtn}>
                  취소
                </button>
                <button type="submit" style={styles.submitBtn}>
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    color: '#4fc3f7',
    margin: 0,
  },
  addButton: {
    padding: '12px 24px',
    backgroundColor: '#4fc3f7',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    color: '#888',
    backgroundColor: '#16213e',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#16213e',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  th: {
    backgroundColor: '#0f3460',
    padding: '16px',
    textAlign: 'left',
    color: '#4fc3f7',
    fontWeight: 600,
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #3a3a5c',
  },
  editBtn: {
    padding: '6px 12px',
    backgroundColor: '#3a3a5c',
    color: '#eee',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '8px',
  },
  deleteBtn: {
    padding: '6px 12px',
    backgroundColor: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#16213e',
    padding: '30px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    color: '#4fc3f7',
    marginBottom: '24px',
  },
  formGroup: {
    marginBottom: '16px',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: '#aaa',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  cancelBtn: {
    padding: '12px 24px',
    backgroundColor: '#3a3a5c',
    color: '#eee',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '12px 24px',
    backgroundColor: '#4fc3f7',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  collectBtn: {
    padding: '12px 20px',
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  collectMsg: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    color: '#81c784',
    fontSize: '14px',
  },
};

export default AdminResearch;
