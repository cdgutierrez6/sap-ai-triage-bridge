import { describe, it, expect } from 'vitest';
import { SapSandboxClient } from '../../src/infrastructure/sap/SapSandboxClient';

describe('SapSandboxClient', () => {
  const client = new SapSandboxClient();

  it('returns mode=sandbox', () => {
    expect(client.mode).toBe('sandbox');
  });

  it('returns at least 10 purchase requisitions', async () => {
    const prs = await client.fetchPurchaseRequisitions();
    expect(prs.length).toBeGreaterThanOrEqual(10);
  });

  it('all PRs have required OData V4 field names', async () => {
    const prs = await client.fetchPurchaseRequisitions();
    for (const pr of prs) {
      expect(pr).toHaveProperty('PurchaseRequisition');
      expect(pr).toHaveProperty('PurchaseRequisitionType');
      expect(pr).toHaveProperty('CompanyCode');
      expect(pr).toHaveProperty('CreatedByUser');
      expect(pr).toHaveProperty('CreationDate');
      expect(pr).toHaveProperty('ProcessingStatus');
      expect(pr).toHaveProperty('to_PurchaseReqnItem');
      expect(Array.isArray(pr.to_PurchaseReqnItem)).toBe(true);
    }
  });

  it('includes variety of PR types', async () => {
    const prs = await client.fetchPurchaseRequisitions();
    const types = new Set(prs.map((pr) => pr.PurchaseRequisitionType));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('includes variety of processing statuses', async () => {
    const prs = await client.fetchPurchaseRequisitions();
    const statuses = new Set(prs.map((pr) => pr.ProcessingStatus));
    expect(statuses.size).toBeGreaterThanOrEqual(2);
  });

  it('includes items with correct OData field names', async () => {
    const prs = await client.fetchPurchaseRequisitions();
    const itemPrs = prs.filter((pr) => pr.to_PurchaseReqnItem.length > 0);
    expect(itemPrs.length).toBeGreaterThan(0);

    const item = itemPrs[0]!.to_PurchaseReqnItem[0]!;
    expect(item).toHaveProperty('PurchaseRequisitionItem');
    expect(item).toHaveProperty('PurchReqnItemCategory');
    expect(item).toHaveProperty('MaterialGroup');
    expect(item).toHaveProperty('Plant');
    expect(item).toHaveProperty('RequestedQuantity');
    expect(item).toHaveProperty('PriceInDocumentCurrency');
    expect(item).toHaveProperty('DocumentCurrency');
  });

  it('testConnectivity returns connected=true in sandbox', async () => {
    const result = await client.testConnectivity();
    expect(result.connected).toBe(true);
  });
});
