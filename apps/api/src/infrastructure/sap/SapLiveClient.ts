import type { SapPurchaseRequisition } from '@sap-triage/shared';
import type { SapODataClientInterface } from './SapODataClient.interface';
import { env } from '../../config/env';
import { AppError } from '../http/middleware/error.middleware';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class SapLiveClient implements SapODataClientInterface {
  readonly mode = 'live' as const;
  private tokenCache: TokenCache | null = null;

  async fetchPurchaseRequisitions(): Promise<SapPurchaseRequisition[]> {
    const token = await this.getAccessToken();
    const baseUrl = env.SAP_BTP_BASE_URL!;
    const url = `${baseUrl}/sap/opu/odata4/sap/api_purchasereq_process/srvd_a2x/sap/purchaserequisition/0001/PurchaseRequisition?$expand=to_PurchaseReqnItem&$top=500`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new AppError('SAP_CONNECTION_ERROR', 'Failed to fetch from SAP OData service', 502);
    }

    const json = (await response.json()) as { value: SapPurchaseRequisition[] };
    return json.value ?? [];
  }

  async testConnectivity(): Promise<{ connected: boolean; message: string }> {
    try {
      await this.getAccessToken();
      return { connected: true, message: 'SAP BTP connection successful' };
    } catch {
      return { connected: false, message: 'Failed to authenticate with SAP BTP' };
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const tokenUrl = env.SAP_BTP_TOKEN_URL!;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.SAP_BTP_CLIENT_ID!,
      client_secret: env.SAP_BTP_CLIENT_SECRET!,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new AppError('SAP_CONNECTION_ERROR', 'Failed to obtain SAP BTP OAuth2 token', 502);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }
}
