import type { SapPurchaseRequisition } from '@sap-triage/shared';

export interface SapODataClientInterface {
  readonly mode: 'live' | 'sandbox';
  fetchPurchaseRequisitions(): Promise<SapPurchaseRequisition[]>;
  testConnectivity(): Promise<{ connected: boolean; message: string }>;
}
