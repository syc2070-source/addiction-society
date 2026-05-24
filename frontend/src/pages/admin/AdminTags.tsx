import React, { useEffect, useState } from 'react';
import { tagsApi } from '../../api';

interface Tag {
  id: number;
  name: string;
  slug?: string;
  category?: string;
}

const AdminTags: React.FC = () => {
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category: 'topic',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await tagsApi.getAll();
      const data = res.data.data || res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setFormData({
      name: '',
      slug: '',
      category: 'topic',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      // 이름 입력 시 slug 자동 생성
      if (name === 'name' && !prev.slug) {
        newData.slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
    };

    try {
      await tagsApi.create(data);
      closeModal();
      loadData();
    } catch (err) {
      alert('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await tagsApi.delete(id);
      loadData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      topic: '주제',
      policy: '정책',
      region: '지역',
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      topic: '#4fc3f7',
      policy: '#81c784',
      region: '#ffb74d',
    };
    return colors[category] || '#888';
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>🏷️ 태그 관리</h1>
        <button onClick={openModal} style={styles.addButton}>
          + 새 태그
        </button>
      </div>

      {loading ? (
        <p>로딩 중...</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          <p>등록된 태그가 없습니다.</p>
          <p>대시보드에서 샘플 데이터를 입력하거나, 새로 추가하세요.</p>
        </div>
      ) : (
        <>
          {/* 태그 클라우드 */}
          <div style={styles.tagCloud}>
            {items.map((item) => (
              <span
                key={item.id}
                style={{
                  ...styles.tagItem,
                  backgroundColor: getCategoryColor(item.category || ''),
                }}
              >
                {item.name}
              </span>
            ))}
          </div>

          {/* 태그 테이블 */}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>이름</th>
                <th style={styles.th}>슬러그</th>
                <th style={styles.th}>카테고리</th>
                <th style={styles.th}>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.id}</td>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.slug || '-'}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.categoryBadge,
                        backgroundColor: getCategoryColor(item.category || ''),
                      }}
                    >
                      {getCategoryLabel(item.category || '')}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => handleDelete(item.id)} style={styles.deleteBtn}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* 모달 */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>새 태그</h2>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>이름 *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  style={styles.input}
                  required
                  placeholder="알코올"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>슬러그</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="alcohol (자동 생성)"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>카테고리</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  style={styles.input}
                >
                  <option value="topic">주제</option>
                  <option value="policy">정책</option>
                  <option value="region">지역</option>
                </select>
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
  tagCloud: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#16213e',
    borderRadius: '12px',
  },
  tagItem: {
    padding: '8px 16px',
    borderRadius: '20px',
    color: '#1a1a2e',
    fontSize: '14px',
    fontWeight: 500,
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
  categoryBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: '#1a1a2e',
    fontSize: '12px',
    fontWeight: 500,
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
    maxWidth: '400px',
  },
  modalTitle: {
    color: '#4fc3f7',
    marginBottom: '24px',
  },
  formGroup: {
    marginBottom: '16px',
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
};

export default AdminTags;
