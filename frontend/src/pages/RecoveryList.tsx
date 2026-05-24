import React, { useEffect, useState } from 'react';
import { recoveryApi } from '../api';

const TYPE_LABELS: Record<string, string> = {
  counseling: '상담센터',
  self_help: '자조모임',
  hotline: '핫라인',
  hospital: '병원',
  shelter: '쉼터',
  other: '기타',
};

const RecoveryList: React.FC = () => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await recoveryApi.getCities();
        setCities(response.data || []);
      } catch (error) {
        console.error('도시 목록 로딩 실패:', error);
      }
    };
    fetchCities();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: any = {};
        if (selectedCity) params.city = selectedCity;
        if (selectedType) params.type = selectedType;
        if (search) params.search = search;

        const response = await recoveryApi.getResources(params);
        setResources(response.data.data || []);
      } catch (error) {
        console.error('회복자원 로딩 실패:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [selectedCity, selectedType, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="page-header">
        <div className="section-kicker">Recovery Resources</div>
        <h1 className="page-title">회복자원</h1>
        <p className="page-desc">
          상담센터, 자조모임, 핫라인 등 회복을 위한 다양한 자원을 검색하고 연결합니다.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <form onSubmit={handleSearch} className="filters">
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색: 이름, 주소, 설명"
            style={{ minWidth: '200px' }}
          />
          <select
            className="filter-select"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option value="">지역: 전체</option>
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">유형: 전체</option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </form>

        {loading ? (
          <p className="loading">로딩 중...</p>
        ) : resources.length === 0 ? (
          <p className="empty">등록된 회복자원이 없습니다.</p>
        ) : (
          <div className="resource-grid">
            {resources.map((item: any) => (
              <div key={item.id} className="resource-card">
                {item.isVerified && (
                  <span className="verified-badge">✓ 인증됨</span>
                )}

                <div className="resource-card-header">
                  <h3 className="resource-card-title">{item.name}</h3>
                  <span className="resource-card-type">
                    {TYPE_LABELS[item.type] || item.type}
                  </span>
                </div>

                {item.description && (
                  <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '12px' }}>
                    {item.description}
                  </p>
                )}

                <div className="resource-card-info">
                  {item.city && (
                    <p><strong>지역:</strong> {item.city}</p>
                  )}
                  {item.address && (
                    <p><strong>주소:</strong> {item.address}</p>
                  )}
                  {item.phone && (
                    <p><strong>전화:</strong> {item.phone}</p>
                  )}
                  {item.operatingHours && (
                    <p><strong>운영시간:</strong> {item.operatingHours}</p>
                  )}
                </div>

                <div className="resource-card-links">
                  {item.website && (
                    <a href={item.website} target="_blank" rel="noopener noreferrer">
                      웹사이트
                    </a>
                  )}
                  {item.email && (
                    <a href={`mailto:${item.email}`}>이메일</a>
                  )}
                  {item.phone && (
                    <a href={`tel:${item.phone}`}>전화하기</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

export default RecoveryList;