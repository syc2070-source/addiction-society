import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Research API
export const researchApi = {
  getAll: (params?: any) => api.get('/research', { params }),
  getOne: (id: number) => api.get(`/research/${id}`),
  getFeatured: () => api.get('/research/featured'),
  getStats: () => api.get('/research/stats'),
  // Admin CRUD
  create: (data: any) => api.post('/research', data),
  update: (id: number, data: any) => api.put(`/research/${id}`, data),
  delete: (id: number) => api.delete(`/research/${id}`),
  autoCollect: () => api.post('/research/auto-collect'),
};

// Policy API
export const policyApi = {
  getDocuments: (params?: any) => api.get('/policy/documents', { params }),
  getDocument: (id: number) => api.get(`/policy/documents/${id}`),
  getMatrix: (documentId: number) => api.get(`/policy/matrix/${documentId}`),
  getStats: () => api.get('/policy/documents/stats'),
  // Admin CRUD
  create: (data: any) => api.post('/policy/documents', data),
  update: (id: number, data: any) => api.put(`/policy/documents/${id}`, data),
  delete: (id: number) => api.delete(`/policy/documents/${id}`),
  // AI 분석
  analyze: (id: number) => api.post(`/policy/documents/${id}/analyze`),
  autoCollect: () => api.post('/policy/documents/auto-collect'),
};

// Recovery API
export const recoveryApi = {
  getResources: (params?: any) => api.get('/recovery/resources', { params }),
  getResource: (id: number) => api.get(`/recovery/resources/${id}`),
  getCities: () => api.get('/recovery/resources/cities'),
  getStats: () => api.get('/recovery/resources/stats'),
  // Admin CRUD
  create: (data: any) => api.post('/recovery/resources', data),
  update: (id: number, data: any) => api.put(`/recovery/resources/${id}`, data),
  delete: (id: number) => api.delete(`/recovery/resources/${id}`),
};

// Tags API
export const tagsApi = {
  getAll: () => api.get('/tags'),
  getGrouped: () => api.get('/tags/grouped'),
  // Admin CRUD
  create: (data: any) => api.post('/tags', data),
  delete: (id: number) => api.delete(`/tags/${id}`),
};

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Sources API (데이터 관측소 레지스트리, 읽기 전용)
export const sourcesApi = {
  getAll: (params?: any) => api.get('/sources', { params }),
  getCalendar: () => api.get('/sources/calendar'),
  getOne: (id: string) => api.get(`/sources/${id}`),
};

// Reports API (Statory proxy)
export const reportsApi = {
  getAll: (params: {
    limit?: number;
    offset?: number;
    scope?: string;
    domain?: string;
    region?: string;
  }) => api.get('/reports', { params }),
  getOne: (id: string, includeSections = false) =>
    api.get(`/reports/${id}`, {
      params: { include_sections: includeSections },
    }),
};

export default api;
