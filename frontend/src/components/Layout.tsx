import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const currentYear = new Date().getFullYear();

  const isActive = (path: string) => location.pathname === path;

  // 로그인 상태 확인
  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <div className="page-wrapper">
      <header>
        <nav className="nav">
          <Link to="/" className="logo">
            <div className="logo-mark"></div>
            <div>
              <span className="kr">중독사회</span>{' '}
              <span className="en">Addiction Society</span>
            </div>
          </Link>

          <div className="nav-links">
            <Link to="/" className={isActive('/') ? 'active' : ''}>
              홈
            </Link>
            <Link to="/research" className={isActive('/research') ? 'active' : ''}>
              연구자료
            </Link>
            <Link to="/policy" className={isActive('/policy') ? 'active' : ''}>
              정책문서
            </Link>
            <Link to="/recovery" className={isActive('/recovery') ? 'active' : ''}>
              회복자원
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isLoggedIn ? (
              <Link to="/admin" className="btn-primary nav-cta">
                관리자
              </Link>
            ) : (
              <Link to="/admin/login" className="btn-primary nav-cta">
                관리자 로그인
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer>
        <div className="footer-inner">
          <div>© {currentYear} 중독사회 · Addiction Society. 모든 권리는 각 저작권자에게 있습니다.</div>
          <div>
            연구·플랫폼: <span style={{ color: '#9ca3af' }}>Addiction Society Lab (향후 확장)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
