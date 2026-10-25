'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginForm, readToken, writeToken } from '../review/ReviewWindow';

type Tab = 'pending' | 'keep' | 'hide' | 'withdrawn';
type Decision = 'keep' | 'hide' | null;

interface EcoItem {
  id: number;
  origin: string;
  slug: string;
  version: string;
  title: string;
  url: string | null;
  grade: string;
  subtype: string[];
  licence: string | null;
  missing: string[] | null;
  upstream: string;
  reviewDecision: Decision;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** 물려받은 keep(SOC-R15 C1) — 관리자 화면에만 꼬리표 */
  inheritedKeep: { label: string; fromVersion: string } | null;
  keyMovedFrom: string | null;
  guestVisible: boolean;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '검토 대기' },
  { key: 'keep', label: '살린 것' },
  { key: 'hide', label: '숨긴 것' },
  { key: 'withdrawn', label: '원천에서 빠짐' },
];

/** 한 쪽 줄 수 — 백엔드 QUEUE_PAGE 와 같음 */
const PAGE = 200;

const ORIGIN_LABEL: Record<string, string> = {
  statory: 'Statory 카드',
  'addicted-news': '중독뉴스',
};

/**
 * 받은 것 검수 창 (SOC-R15 ■1 · ■4) — research 검수 창과 같은 로그인 · 같은 틀.
 * 물려받은 keep 은 손님 화면에 그대로 서고, 여기에만 「이전 판 승인」 꼬리표가 붙는다(C1).
 */
export default function EcoReviewWindow({ apiUrl }: { apiUrl: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<EcoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** 앞 쪽 마지막 id(keyset) — 결정한 줄이 탭에서 빠져도 건너뛰는 줄 0 · null = 처음 */
  const [before, setBefore] = useState<number | null>(null);

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
    const cut = before ? `&before=${before}` : '';
    fetch(`${apiUrl}/api/admin/eco/review?tab=${tab}${cut}`, {
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
        const rows = (await res.json()) as EcoItem[];
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
  }, [apiUrl, tab, before, token, logout]);

  async function decide(id: number, decision: Decision) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/admin/eco/${id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
              setBefore(null);
              setTab(t.key);
            }}
          >
            {t.label}
            {tab === t.key && items ? ` (${items.length})` : ''}
          </button>
        ))}
        {before !== null && (
          <button
            type="button"
            className="filter-select"
            onClick={() => {
              setItems(null);
              setBefore(null);
            }}
          >
            처음으로
          </button>
        )}
        {items && items.length >= PAGE && (
          <button
            type="button"
            className="filter-select"
            onClick={() => {
              const last = items[items.length - 1];
              setItems(null);
              setBefore(last.id);
            }}
          >
            다음 {PAGE}
          </button>
        )}
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
                #{it.id} · {ORIGIN_LABEL[it.origin] ?? it.origin} · {it.grade}
                {it.version ? ` · ${it.version}` : ''}
              </div>
              <div className="list-item-title">{it.title}</div>
              <div className="list-item-desc">
                {it.inheritedKeep && (
                  <span className="tag tag-warn">
                    {it.inheritedKeep.label} (keep_from_version{' '}
                    {it.inheritedKeep.fromVersion})
                  </span>
                )}{' '}
                {it.keyMovedFrom && (
                  <span className="tag">열쇠 옮김: {it.keyMovedFrom}</span>
                )}{' '}
                {it.licence && <span className="tag">면허 {it.licence}</span>}{' '}
                {it.missing && it.missing.length > 0 && (
                  <span className="tag">빈 칸 {it.missing.join(', ')}</span>
                )}{' '}
                {it.subtype.length > 0 && (
                  <span className="tag">{it.subtype.join(', ')}</span>
                )}{' '}
                {it.guestVisible && <span className="tag">손님에게 보임</span>}
              </div>
              {it.url && (
                <a
                  className="ext-link"
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  원문 ↗
                </a>
              )}
              {it.reviewedBy && (
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
                {it.reviewDecision !== 'keep' || it.inheritedKeep ? (
                  <button
                    type="button"
                    className="btn-submit"
                    disabled={busyId === it.id}
                    onClick={() => decide(it.id, 'keep')}
                  >
                    {it.inheritedKeep ? '이 판 살림(다시 봄)' : '살림'}
                  </button>
                ) : null}
                {it.reviewDecision !== 'hide' && (
                  <button
                    type="button"
                    className="filter-select"
                    disabled={busyId === it.id}
                    onClick={() => decide(it.id, 'hide')}
                  >
                    숨김
                  </button>
                )}
                {it.reviewDecision !== null && (
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
