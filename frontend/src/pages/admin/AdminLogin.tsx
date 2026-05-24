import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api';

// ========== 관리자 계정 설정 ==========
// 여기서 관리자 이메일과 비밀번호를 설정하세요
const ADMIN_EMAIL = 'admin@addiction.kr';
const ADMIN_PASSWORD = 'addiction2025!';
const ADMIN_NAME = '관리자';
// =====================================

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/admin');
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStatus('');

    // 고정 관리자 계정만 허용
    if (formData.email !== ADMIN_EMAIL || formData.password !== ADMIN_PASSWORD) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      // 먼저 로그인 시도
      setStatus('로그인 시도 중...');
      const loginRes = await authApi.login({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      localStorage.setItem('token', loginRes.data.accessToken);
      localStorage.setItem('adminUser', JSON.stringify({ email: ADMIN_EMAIL, name: ADMIN_NAME }));
      navigate('/admin');
    } catch (loginErr: any) {
      // 로그인 실패 시 회원가입 시도
      if (loginErr.response?.status === 401 || loginErr.response?.status === 404) {
        try {
          setStatus('관리자 계정 생성 중...');
          await authApi.register({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            name: ADMIN_NAME,
          });

          // 회원가입 성공 후 로그인
          setStatus('로그인 중...');
          const loginRes = await authApi.login({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
          });

          localStorage.setItem('token', loginRes.data.accessToken);
          localStorage.setItem('adminUser', JSON.stringify({ email: ADMIN_EMAIL, name: ADMIN_NAME }));
          navigate('/admin');
        } catch (regErr: any) {
          // 이미 계정이 있지만 비밀번호가 다른 경우
          setError('관리자 계정 설정에 문제가 있습니다. 백엔드를 확인하세요.');
        }
      } else {
        setError('서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인하세요.');
      }
    }

    setLoading(false);
    setStatus('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1 style={styles.title}>🔐 중독사회 Admin</h1>
        <p style={styles.subtitle}>관리자 전용 로그인</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="관리자 이메일"
            value={formData.email}
            onChange={handleChange}
            style={styles.input}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="비밀번호"
            value={formData.password}
            onChange={handleChange}
            style={styles.input}
            required
          />

          {error && <p style={styles.error}>{error}</p>}
          {status && <p style={styles.status}>{status}</p>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>

        <div style={styles.hint}>
          <p>관리자 계정:</p>
          <p>
            <strong>{ADMIN_EMAIL}</strong>
          </p>
        </div>

        <div style={styles.backLink}>
          <Link to="/" style={styles.link}>
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  box: {
    backgroundColor: '#16213e',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    textAlign: 'center',
    color: '#4fc3f7',
    marginBottom: '8px',
    fontSize: '24px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#888',
    marginBottom: '30px',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    marginBottom: '16px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4fc3f7',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: '16px',
    fontSize: '14px',
  },
  status: {
    color: '#4fc3f7',
    textAlign: 'center',
    marginBottom: '16px',
    fontSize: '14px',
  },
  hint: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    textAlign: 'center',
    color: '#888',
    fontSize: '13px',
  },
  backLink: {
    textAlign: 'center',
    marginTop: '20px',
  },
  link: {
    color: '#888',
    textDecoration: 'none',
    fontSize: '14px',
  },
};

export default AdminLogin;
