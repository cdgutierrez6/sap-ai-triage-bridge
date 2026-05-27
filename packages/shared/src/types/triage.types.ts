export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type BudgetType = 'CAPEX' | 'OPEX' | 'UNKNOWN';

export type AnomalyType =
  | 'PRICE_OUTLIER'
  | 'QUANTITY_SPIKE'
  | 'MISSING_DELIVERY_DATE'
  | 'UNKNOWN_MATERIAL_GROUP'
  | 'DUPLICATE_MATERIAL'
  | 'RUSH_DELIVERY'
  | 'HIGH_VALUE_SINGLE_VENDOR'
  | 'MISSING_SUPPLIER';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface Anomaly {
  type: AnomalyType;
  field: string;
  description: string;
  severity: AnomalySeverity;
}

export interface TriageResult {
  id: string;
  requisitionId: string;
  riskScore: number;        // 0-100 integer
  riskLevel: RiskLevel;
  spendCategory: string;
  budgetType: BudgetType;
  anomalies: Anomaly[];
  aiSummary: string;
  recommendations: string[];
  aiProvider: string;
  aiModel: string;
  promptTokens: number | null;
  completionTokens: number | null;
  processingTimeMs: number | null;
  triagedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 24) return 'low';
  if (score <= 49) return 'medium';
  if (score <= 74) return 'high';
  return 'critical';
}
