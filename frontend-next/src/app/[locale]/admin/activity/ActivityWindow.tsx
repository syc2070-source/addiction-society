'use client';

import { useEffect, useState } from 'react';
import { LoginForm, readToken, writeToken } from '../review/ReviewWindow';

/**
 * 운영 로그 창 (/admin/activity, SOC-R19 ■3) — 홈의 「최근 관측 활동」(변경 감지 · 차단 · 수동 확인 필요 …)을
 * 손님 화면에서 옮겨 온 자리. 읽기 전용 · 로그인 뒤에만 그린다.
 * 자료는 공개 API GET /api/timeline 그대로(공개 API 는 바꾸지 않음 · 손님 연대기 페이지도 그대로).
 */

interface Ev {
  id: number;
  sourceId: string;
  orgKo: string | null;
  titleKo: string | null;
  url: string | null;
  eventType: string;
  detectedAt: string;
  notRelease?: boolean;
  detail: Record<string, unknown> | null;
}

interface Summary {
  periodDays: number;
  total: number;
  byType: Record<string, number>;
  sourcesChecked: number;
  lastEventAt: string | null;
}

const LABEL: Record<string, string> = {
  published: '발간 감지',
  changed: '변경 감지',
  checked: '확인',
  failed: '실패',
  stale: '정지',
  manual: '수동 확인 필요',
  blocked: '차단',
  rescheduled: '예정일 이월',
  source_updated: '감시 주소 변경',
  document_updated: '문서 링크 변경',
};

/** 손님 홈 v2 에 남는 사건(발간 감지)만 「손님에게 보임」 */
const GUEST = new Set(['published']);

export default function ActivityWindow({ apiUrl }: { apiUrl: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Ev[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideChecked, setHideChecked] = useState(true);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToken(readToken()), []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`${apiUrl}/api/timeline?limit=200&all=true`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { data: Ev[]; summary?: Summary };
        if (!alive) return;
        setRows(body.data);
        setSummary(body.summary ?? null);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(`운영 로그를 불러오지 못했습니다 (${String(e)})`);
      });
    return () => {
      alive = false;
    };
  }, [apiUrl, token]);

  if (!token) {
    return (
      <LoginForm
        apiUrl={apiUrl}
        notice={error}
        onLogin={(t) => {
          writeToken(t);
          setToken(t);
        }}
      />
    );
  }

  const shown = (rows ?? []).filter((e) => !hideChecked || e.eventType !== 'checked');

  return (
    <section>
      <div className="search-form">
        <button
          type="button"
          className={hideChecked ? 'btn-submit' : 'filter-select'}
          onClick={() => setHideChecked((v) => !v)}
        >
          {hideChecked ? '「확인」 줄 숨김 중' : '「확인」 줄 보임'}
        </button>
        <button
          type="button"
          className="filter-select"
          onClick={() => {
            writeToken(null);
            setToken(null);
            setRows(null);
          }}
        >
          로그아웃
        </button>
      </div>
      {summary && (
        <p className="status-note">
          최근 {summary.periodDays}일 · 사건 {summary.total} · 소스 {summary.sourcesChecked}곳 ·{' '}
          {Object.entries(summary.byType)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${LABEL[k] ?? k} ${n}`)
            .join(' · ')}
        </p>
      )}
      {error && <p className="status-note">{error}</p>}
      {!rows ? (
        <p className="status-note">불러오는 중…</p>
      ) : (
        <ul className="timeline-list">
          {shown.map((e) => (
            <li key={e.id} className="timeline-item">
              <span className="timeline-date">
                {e.detectedAt.slice(0, 16).replace('T', ' ')}Z
              </span>
              <span className={`timeline-badge badge-${e.eventType}`}>
                {LABEL[e.eventType] ?? e.eventType}
                {e.notRelease ? ' · 발간 아님' : ''}
              </span>
              <span className="timeline-body">
                <span className="timeline-org">{e.orgKo ?? e.sourceId}</span>
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="timeline-source"
                  >
                    {e.titleKo ?? e.sourceId}
                  </a>
                ) : (
                  <span className="timeline-source">{e.titleKo ?? e.sourceId}</span>
                )}
                <span
                  className={`tag ${GUEST.has(e.eventType) && !e.notRelease ? '' : 'tag-warn'}`}
                >
                  {GUEST.has(e.eventType) && !e.notRelease
                    ? '손님에게 보임(홈 v2)'
                    : '운영 전용'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
