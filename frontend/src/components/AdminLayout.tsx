import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && location.pathname !== '/admin/login') {
      navigate('/admin/login');
    }
  }, [location, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin', label: '대시보드', icon: '📊' },
    { path: '/admin/research', label: '연구자료', icon: '📄' },
    { path: '/admin/policy', label: '정책문서', icon: '📋' },
    { path: '/admin/recovery', label: '회복자원', icon: '🏥' },
    { path: '/admin/tags', label: '태그관리', icon: '🏷️' },
  ];

  // 로그인 페이지는 레이아웃 없이 렌더링
  if (location.pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div style={styles.container}>
      {/* 사이드바 */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>📚 중독사회</h2>
          <p style={styles.subtitle}>Admin Panel</p>
        </div>

        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.navItem,
                ...(location.pathname === item.path ? styles.navItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <Link to="/" style={styles.backLink}>
            ← 사이트로 돌아가기
          </Link>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
  },
  sidebar: {
    width: '250px',
    backgroundColor: '#16213e',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    height: '100vh',
    left: 0,
    top: 0,
  },
  sidebarHeader: {
    padding: '0 20px 20px',
    borderBottom: '1px solid #3a3a5c',
  },
  logo: {
    color: '#4fc3f7',
    fontSize: '22px',
    margin: 0,
  },
  subtitle: {
    color: '#888',
    fontSize: '12px',
    margin: '5px 0 0',
  },
  nav: {
    flex: 1,
    padding: '20px 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 20px',
    color: '#ccc',
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s',
  },
  navItemActive: {
    backgroundColor: '#1a1a2e',
    borderLeftColor: '#4fc3f7',
    color: '#4fc3f7',
  },
  navIcon: {
    marginRight: '12px',
    fontSize: '18px',
  },
  sidebarFooter: {
    padding: '20px',
    borderTop: '1px solid #3a3a5c',
  },
  backLink: {
    display: 'block',
    color: '#888',
    textDecoration: 'none',
    fontSize: '13px',
    marginBottom: '12px',
  },
  logoutBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    marginLeft: '250px',
    padding: '30px',
    color: '#eee',
  },
};

export default AdminLayout;
