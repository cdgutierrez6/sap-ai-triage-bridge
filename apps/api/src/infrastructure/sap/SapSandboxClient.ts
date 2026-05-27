import type { SapPurchaseRequisition } from '@sap-triage/shared';
import type { SapODataClientInterface } from './SapODataClient.interface';
import { SAP_MOCK_REQUISITIONS } from './sap.mock-data';

export class SapSandboxClient implements SapODataClientInterface {
  readonly mode = 'sandbox' as const;

  async fetchPurchaseRequisitions(): Promise<SapPurchaseRequisition[]> {
    await this.simulateLatency();
    return SAP_MOCK_REQUISITIONS;
  }

  async testConnectivity(): Promise<{ connected: boolean; message: string }> {
    return {
      connected: true,
      message: 'Sandbox mode — no real SAP connection. Mock data ready.',
    };
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 50));
  }
}
