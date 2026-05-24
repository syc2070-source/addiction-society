import React, { useEffect, useState } from 'react';
import { recoveryApi } from '../../api';

interface Recovery {
  id: number;
  name: string;
  type?: string;
  city?: string;
  address?: string;
  phone?: string;
  operatingHours?: string;
  website?: string;
  description?: string;
}

const AdminRecovery: React.FC = () => {
  const [items, setItems] = useState<Recovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Recovery | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'center',
    city: '',
    address: '',
    phone: '',
    operatingHours: '',
    website: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await recoveryApi.getResources();
      const data = res.data.data || res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item?: Recovery) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name || '',
        type: item.type || 'center',
        city: item.city || '',
        address: item.address || '',
        phone: item.phone || '',
        operatingHours: item.operatingHours || '',
        website: item.website || '',
        description: item.description || '',
      });
    } else {
      setEditItem(null);
      setFormData({
        name: '',
        type: 'center',
        city: '',
        address: '',
        phone: '',
        operatingHours: '',
        website: '',
        description: '',
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

    try {
      if (editItem) {
        await recoveryApi.update(editItem.id, formData);
      } else {
        await recoveryApi.create(formData);
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
      await recoveryApi.delete(id);
      loadData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      hospital: '병원',
      center: '상담센터',
      group: '자조모임',
      hotline: '핫라인',
      other: '기타',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>🏥 회복자원 관리</h1>
        <button onClick={() => openModal()} style={styles.addButton}>
          + 새 회복자원
        </button>
      </div>

      {loading ? (
        <p>로딩 중...</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          <p>등록된 회복자원이 없습니다.</p>
          <p>대시보드에서 샘플 데이터를 입력하거나, 새로 추가하세요.</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>기관명</th>
              <th style={styles.th}>유형</th>
              <th style={styles.th}>도시</th>
              <th style={styles.th}>연락처</th>
              <th style={styles.th}>작업</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.td}>{item.id}</td>
                <td style={styles.td}>{item.name}</td>
                <td style={styles.td}>{getTypeLabel(item.type || '')}</td>
                <td style={styles.td}>{item.city || '-'}</td>
                <td style={styles.td}>{item.phone || '-'}</td>
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
              {editItem ? '회복자원 수정' : '새 회복자원'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>기관명 *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>유형</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    style={styles.input}
                  >
                    <option value="hospital">병원</option>
                    <option value="center">상담센터</option>
                    <option value="group">자조모임</option>
                    <option value="hotline">핫라인</option>
                    <option value="other">기타</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>도시</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="서울"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>주소</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>연락처</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="02-000-0000"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>운영시간</label>
                  <input
                    type="text"
                    name="operatingHours"
                    value={formData.operatingHours}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="평일 09:00-18:00"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>웹사이트</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>설명</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  style={styles.textarea}
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
};

export default AdminRecovery;
