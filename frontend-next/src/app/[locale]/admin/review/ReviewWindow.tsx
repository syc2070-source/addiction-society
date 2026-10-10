'use client';

import { useCallback, useEffect, useState } from 'react';

type Tab = 'pending' | 'keep' | 'hide';
type Decision = 'keep' | 'hide' | null;

interface ReviewItem {
  id: number;
  title: string;
  source: string | null;
  sourceUrl: string | null;
  year: number | null;
  abstractPreview: string;
  gateReason: string;
  reviewDecision: Decision;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '검토 대기' },
  { key: 'keep', label: '살린 것' },
  { key: 'hide', label: '숨긴 것' },
];

/** 토큰은 이 탭이 열려 있는 동안만 둔다(sessionStorage). */
const TOKEN_KEY = 'as_admin_token';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 저장 불가(사생활 모드 등) — 이번 화면에서만 유지 */
  }
}

export default function ReviewWindow({ apiUrl }: { apiUrl: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // 브라우저 저장소는 수화(hydration) 뒤에만 읽을 수 있다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToken(readToken()), []);

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setItems(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`${apiUrl}/api/admin/research/review?tab=${tab}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401 || res.status === 403) {
          logout();
          setError(
            '로그인이 끝났거나 관리자 권한이 없습니다. 다시 로그인하세요.',
          );
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = (await res.json()) as ReviewItem[];
        if (alive) {
          setItems(rows);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(`목록을 불러오지 못했습니다 (${String(e)})`);
      });
    return () => {
      alive = false;
    };
  }, [apiUrl, tab, token, logout]);

  async function decide(id: number, decision: Decision) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/admin/research/${id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 공개 연구 목록 캐시를 비운다(관리자 토큰을 서버가 다시 확인).
      await fetch('/api/revalidate/research', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      setItems((prev) => prev?.filter((it) => it.id !== id) ?? prev);
    } catch (e) {
      setError(`#${id} 결정을 저장하지 못했습니다 (${String(e)})`);
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <LoginForm
        apiUrl={apiUrl}
        notice={error}
        onLogin={(t) => {
          writeToken(t);
          setToken(t);
          setError(null);
        }}
      />
    );
  }

  return (
    <section>
      <div className="search-form" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'btn-submit' : 'filter-select'}
            onClick={() => {
              setItems(null);
              setTab(t.key);
            }}
          >
            {t.label}
            {tab === t.key && items ? ` (${items.length})` : ''}
          </button>
        ))}
        <button type="button" className="filter-select" onClick={logout}>
          로그아웃
        </button>
      </div>

      {error && <p className="status-note">{error}</p>}
      {!items ? (
        <p className="status-note">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="status-note">이 탭에는 자료가 없습니다.</p>
      ) : (
        <ul className="list-grid" style={{ listStyle: 'none', padding: 0 }}>
          {items.map((it) => (
            <li key={it.id} className="list-item">
              <div className="list-item-meta">
                #{it.id} · {it.source ?? '출처 미상'}
                {it.year ? ` · ${it.year}` : ''}
              </div>
              <div className="list-item-title">{it.title}</div>
              <div className="list-item-desc">
                <span className="tag tag-warn">관문: {it.gateReason}</span>
              </div>
              <p className="list-item-desc">
                {it.abstractPreview
                  ? `${it.abstractPreview}${it.abstractPreview.length >= 200 ? '…' : ''}`
                  : '(초록 없음)'}
              </p>
              {it.sourceUrl && (
                <a
                  className="ext-link"
                  href={it.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  원문 ↗
                </a>
              )}
              {it.reviewedBy && tab !== 'pending' && (
                <div className="list-item-meta">
                  {it.reviewedBy} ·{' '}
                  {it.reviewedAt
                    ? new Date(it.reviewedAt).toLocaleString('ko-KR')
                    : ''}
                </div>
              )}
              <div
                className="search-form"
                style={{ marginTop: 8, marginBottom: 0 }}
              >
                {tab === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className="btn-submit"
                      disabled={busyId === it.id}
                      onClick={() => decide(it.id, 'keep')}
                    >
                      살림
                    </button>
                    <button
                      type="button"
                      className="filter-select"
                      disabled={busyId === it.id}
                      onClick={() => decide(it.id, 'hide')}
                    >
                      숨김
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="filter-select"
                    disabled={busyId === it.id}
                    onClick={() => decide(it.id, null)}
                  >
                    되돌리기 (검토 대기로)
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LoginForm({
  apiUrl,
  notice,
  onLogin,
}: {
  apiUrl: string;
  notice: string | null;
  onLogin: (token: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok)
        throw new Error(
          res.status === 401
            ? '이메일 또는 비밀번호가 틀립니다'
            : `HTTP ${res.status}`,
        );
      const body = (await res.json()) as {
        accessToken: string;
        user?: { role?: string };
      };
      if (body.user?.role !== 'admin')
        throw new Error('관리자 계정이 아닙니다');
      setPassword('');
      onLogin(body.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="search-form"
      onSubmit={submit}
      style={{ flexDirection: 'column', maxWidth: 360 }}
    >
      {notice && <p className="status-note">{notice}</p>}
      <input
        className="search-input"
        type="email"
        autoComplete="username"
        placeholder="관리자 이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="search-input"
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="btn-submit" disabled={busy}>
        {busy ? '확인 중…' : '로그인'}
      </button>
      {error && <p className="status-note">{error}</p>}
    </form>
  );
}
