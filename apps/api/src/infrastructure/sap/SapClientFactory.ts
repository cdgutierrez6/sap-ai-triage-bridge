import type { SapODataClientInterface } from './SapODataClient.interface';
import { SapSandboxClient } from './SapSandboxClient';
import { SapLiveClient } from './SapLiveClient';

export class SapClientFactory {
  static create(mode: 'live' | 'sandbox'): SapODataClientInterface {
    return mode === 'live' ? new SapLiveClient() : new SapSandboxClient();
  }
}
