import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRiskLevel } from '@sap-triage/shared';
import type { AIProvider, AIProviderResult } from '../../src/domains/triage/providers/AIProvider.interface';
import type { SapPurchaseRequisition } from '@sap-triage/shared';

describe('getRiskLevel', () => {
  it.each([
    [0, 'low'],
    [24, 'low'],
    [25, 'medium'],
    [49, 'medium'],
    [50, 'high'],
    [74, 'high'],
    [75, 'critical'],
    [100, 'critical'],
  ])('score %i → %s', (score, expected) => {
    expect(getRiskLevel(score)).toBe(expected);
  });
});

describe('MockAIProvider', () => {
  const mockOutput = {
    riskScore: 72,
    spendCategory: 'IT Hardware',
    budgetType: 'CAPEX' as const,
    anomalies: [
      { type: 'PRICE_OUTLIER' as const, field: 'PriceInDocumentCurrency', description: 'Price is 3x average', severity: 'high' as const },
    ],
    aiSummary: 'This PR shows elevated risk due to price anomaly.',
    recommendations: ['Request 3 vendor quotes', 'Verify budget availability'],
  };

  const mockProvider: AIProvider = {
    name: 'mock',
    analyze: vi.fn().mockResolvedValue({
      output: mockOutput,
      model: 'mock-model',
      promptTokens: 100,
      completionTokens: 50,
    } satisfies AIProviderResult),
  };

  beforeEach(() => vi.clearAllMocks());

  it('mock provider returns valid AIProviderResult shape', async () => {
    const pr = { PurchaseRequisition: '0010001001' } as SapPurchaseRequisition;
    const result = await mockProvider.analyze(pr);
    expect(result.output.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.output.riskScore).toBeLessThanOrEqual(100);
    expect(['CAPEX', 'OPEX', 'UNKNOWN']).toContain(result.output.budgetType);
    expect(result.output.anomalies).toBeInstanceOf(Array);
    expect(typeof result.output.aiSummary).toBe('string');
    expect(result.output.aiSummary.length).toBeGreaterThan(10);
  });
});
