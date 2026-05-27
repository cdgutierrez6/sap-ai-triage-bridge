import type { RiskLevel, TriageResult } from './triage.types';
import type { ProcessingStatus } from './sap.types';

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sandboxMode: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface RequisitionListItem {
  id: string;
  purchaseRequisition: string;
  purchaseRequisitionType: string;
  description: string | null;
  companyCode: string;
  createdByUser: string;
  creationDate: string;
  processingStatus: ProcessingStatus;
  sandboxMode: boolean;
  syncedAt: string;
  itemCount: number;
  totalValue: number | null;
  currency: string | null;
  triage: TriageSummary | null;
}

export interface TriageSummary {
  riskScore: number;
  riskLevel: RiskLevel;
  spendCategory: string;
  budgetType: string;
  triagedAt: string;
}

export interface RequisitionItem {
  id: string;
  purchaseRequisitionItem: string;
  purchReqnItemCategory: string | null;
  accountAssignmentCategory: string | null;
  shortText: string | null;
  material: string | null;
  materialGroup: string | null;
  plant: string | null;
  storageLocation: string | null;
  requestedQuantity: number | null;
  requestedQuantityUnit: string | null;
  priceInDocumentCurrency: number | null;
  documentCurrency: string | null;
  totalPrice: number | null;
  deliveryDate: string | null;
  purchasingGroup: string | null;
  purchasingOrganization: string | null;
  requisitioner: string | null;
  supplier: string | null;
  itemProcessingStatus: string | null;
}

export interface RequisitionDetail extends RequisitionListItem {
  lastChangeDateTime: string;
  rawSapPayload: unknown;
  items: RequisitionItem[];
  triage: TriageResult | null;
}

export interface RequisitionFilters {
  status?: string;
  riskLevel?: RiskLevel;
  plant?: string;
  materialGroup?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  dbConnected: boolean;
  aiProvider: string;
  sapMode: 'live' | 'sandbox';
  version: string;
  timestamp: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
    requestId?: string;
  };
}

export interface SyncResult {
  mode: string;
  recordsFetched: number;
  recordsUpserted: number;
  durationMs: number;
  syncedAt: string;
}
