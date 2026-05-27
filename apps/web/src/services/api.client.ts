import type {
  PaginatedResponse,
  RequisitionListItem,
  RequisitionDetail,
  RequisitionFilters,
  TriageResult,
  SyncResult,
  HealthResponse,
} from '@sap-triage/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options?.headers,
    },
  });

  const json = await response.json() as unknown;

  if (!response.ok) {
    const err = json as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Request failed: ${response.status}`);
  }

  return json as T;
}

function buildQueryString(filters: RequisitionFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.riskLevel) params.set('riskLevel', filters.riskLevel);
  if (filters.plant) params.set('plant', filters.plant);
  if (filters.materialGroup) params.set('materialGroup', filters.materialGroup);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const apiClient = {
  requisitions: {
    list: (filters: RequisitionFilters = {}) =>
      request<PaginatedResponse<RequisitionListItem>>(`/api/v1/requisitions${buildQueryString(filters)}`),

    getById: (id: string) =>
      request<{ data: RequisitionDetail }>(`/api/v1/requisitions/${id}`),
  },

  triage: {
    run: (requisitionId: string) =>
      request<{ data: TriageResult }>(`/api/v1/triage/run/${requisitionId}`, { method: 'POST' }),

    getResult: (requisitionId: string) =>
      request<{ data: TriageResult }>(`/api/v1/triage/${requisitionId}`),
  },

  sync: {
    trigger: () =>
      request<{ data: SyncResult }>('/api/v1/sync/trigger', { method: 'POST' }),
  },

  health: {
    check: () =>
      request<HealthResponse>('/api/v1/health'),
  },
};
