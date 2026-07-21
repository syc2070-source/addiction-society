/**
 * 백엔드 API 클라이언트 (서버 컴포넌트용).
 * NEXT_PUBLIC_API_URL: 로컬 http://localhost:3001 / 운영 https://addiction-society-api.onrender.com
 *
 * 모든 fetcher는 실패 시 null을 반환하고, 화면은 "수집 중"으로 처리한다
 * (가짜 데이터 금지 — 블루프린트 불변 원칙 1).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** 공통 GET. 실패/비200 → null. 기본 5분 재검증(발표 감시가 일 1회라 충분). */
async function get<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── 관측소 요약 ──

export interface SummaryItem {
  id: string;
  date: string;
  label: string;
  /** titleEn — /en 표시용. 구버전 API에는 없을 수 있어 optional */
  labelEn?: string;
  org: string;
}

export interface SourcesSummary {
  total: number;
  byScope: Record<string, number>;
  recent: SummaryItem[];
  upcoming: SummaryItem[];
}

export function fetchSourcesSummary() {
  return get<SourcesSummary>('/api/sources/summary');
}

// ── 소스 레지스트리 ──

export interface Source {
  id: string;
  org: string;
  orgKo: string;
  domain: string;
  scope: string;
  kind: string;
  titleKo: string;
  titleEn: string;
  url: string;
  cadence: string;
  lastPublishedAt: string | null;
  nextExpectedAt: string | null;
  status: string;
  license: string | null;
  reliability: number | null;
}

export interface SourceListResult {
  data: Source[];
  total: number;
}

export function fetchSources(params: {
  search?: string;
  domain?: string;
  scope?: string;
  cadence?: string;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.domain) qs.set('domain', params.domain);
  if (params.scope) qs.set('scope', params.scope);
  if (params.cadence) qs.set('cadence', params.cadence);
  const q = qs.toString();
  return get<SourceListResult>(`/api/sources${q ? `?${q}` : ''}`);
}

export function fetchCalendar() {
  return get<Source[]>('/api/sources/calendar');
}

// ── 자료실 3종 (페이지네이션 목록 공통 형태) ──

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PolicyDocument {
  id: number;
  title: string;
  country: string;
  year: number | null;
  description: string | null;
  summary: string | null;
  sourceUrl: string | null;
}

export interface Research {
  id: number;
  title: string;
  authors: string[] | null;
  year: number | null;
  abstract: string | null;
  summary: string | null;
  keywords: string[] | null;
  sourceUrl: string | null;
}

export interface RecoveryResource {
  id: number;
  name: string;
  type: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  isVerified: boolean;
}

function pagedQuery(params: { page?: number; search?: string }, limit = 12) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(limit));
  if (params.search) qs.set('search', params.search);
  return qs.toString();
}

export function fetchPolicyDocuments(params: { page?: number; search?: string }) {
  return get<Paginated<PolicyDocument>>(
    `/api/policy/documents?${pagedQuery(params)}`,
  );
}

export function fetchResearch(params: { page?: number; search?: string }) {
  return get<Paginated<Research>>(`/api/research?${pagedQuery(params)}`);
}

export function fetchRecoveryResources(params: {
  page?: number;
  search?: string;
}) {
  return get<Paginated<RecoveryResource>>(
    `/api/recovery/resources?${pagedQuery(params, 24)}`,
  );
}
