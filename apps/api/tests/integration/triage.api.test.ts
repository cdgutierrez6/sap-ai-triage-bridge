import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted runs before all imports, making mockAnalyze available in vi.mock factory
const mockAnalyze = vi.hoisted(() => vi.fn());

// Mock AIProviderFactory so triage tests never call the real Claude API
vi.mock('../../src/domains/triage/providers/AIProviderFactory', () => ({
  AIProviderFactory: {
    create: () => ({
      name: 'mock-claude',
      analyze: mockAnalyze,
    }),
  },
}));

import app from '../../src/index';
import { prisma } from './setup';

const API_KEY = process.env.API_KEY ?? 'test-api-key-that-is-at-least-32-chars-long';
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET ?? 'test-webhook-secret-16chars';

const VALID_AI_RESULT = {
  output: {
    riskScore: 45,
    spendCategory: 'IT Hardware',
    budgetType: 'CAPEX' as const,
    anomalies: [
      {
        type: 'PRICE_OUTLIER' as const,
        field: 'PriceInDocumentCurrency',
        description: 'Unit price significantly above IT hardware category average',
        severity: 'high' as const,
      },
    ],
    aiSummary: 'This PR shows elevated risk due to a price outlier in IT hardware procurement.',
    recommendations: ['Request 3 competitive vendor quotes', 'Verify budget availability'],
  },
  model: 'mock-model-v1',
  promptTokens: 150,
  completionTokens: 80,
};

async function seedRequisition(purchaseRequisition = '0010099001') {
  return prisma.purchaseRequisition.create({
    data: {
      purchaseRequisition,
      purchaseRequisitionType: 'NB',
      description: 'Test PR for triage integration',
      companyCode: '1000',
      createdByUser: 'TESTUSER',
      creationDate: new Date('2026-05-01'),
      lastChangeDateTime: new Date(),
      processingStatus: '01',
      rawSapPayload: {
        PurchaseRequisition: purchaseRequisition,
        PurchaseRequisitionType: 'NB',
        PurReqnDescription: 'Test PR for triage integration',
        CompanyCode: '1000',
        CreatedByUser: 'TESTUSER',
        CreationDate: '2026-05-01',
        LastChangeDateTime: '2026-05-01T00:00:00Z',
        ProcessingStatus: '01',
        to_PurchaseReqnItem: [],
      },
      sandboxMode: true,
      syncedAt: new Date(),
    },
  });
}

describe('POST /api/v1/triage/run/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyze.mockResolvedValue(VALID_AI_RESULT);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app).post('/api/v1/triage/run/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 for non-UUID requisitionId', async () => {
    const res = await request(app)
      .post('/api/v1/triage/run/not-a-valid-uuid')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a valid UUID that does not exist in DB', async () => {
    const res = await request(app)
      .post('/api/v1/triage/run/00000000-0000-0000-0000-000000000000')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 triage result for existing PR', async () => {
    const pr = await seedRequisition();
    const res = await request(app)
      .post(`/api/v1/triage/run/${pr.id}`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      requisitionId: pr.id,
      riskScore: 45,
      riskLevel: 'medium',
      spendCategory: 'IT Hardware',
      budgetType: 'CAPEX',
      aiProvider: 'mock-claude',
    });
    expect(Array.isArray(res.body.data.anomalies)).toBe(true);
    expect(res.body.data.anomalies[0].type).toBe('PRICE_OUTLIER');
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  it('upserts triage result on re-run (idempotent)', async () => {
    const pr = await seedRequisition('0010099002');
    await request(app).post(`/api/v1/triage/run/${pr.id}`).set('X-API-Key', API_KEY);
    mockAnalyze.mockResolvedValueOnce({ ...VALID_AI_RESULT, output: { ...VALID_AI_RESULT.output, riskScore: 60 } });
    const res = await request(app).post(`/api/v1/triage/run/${pr.id}`).set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.riskScore).toBe(60);
    const count = await prisma.triageResult.count({ where: { requisitionId: pr.id } });
    expect(count).toBe(1); // upsert — only one record per PR
  });

  it('returns 502 when AI provider throws', async () => {
    const pr = await seedRequisition('0010099003');
    mockAnalyze.mockRejectedValueOnce(new Error('Claude API timeout'));
    const res = await request(app)
      .post(`/api/v1/triage/run/${pr.id}`)
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_PROVIDER_ERROR');
    // Raw error message must not be forwarded to client
    expect(JSON.stringify(res.body)).not.toContain('Claude API timeout');
  });
});

describe('POST /api/v1/triage/run-batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyze.mockResolvedValue(VALID_AI_RESULT);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .post('/api/v1/triage/run-batch')
      .send({ requisitionIds: ['00000000-0000-0000-0000-000000000001'] });
    expect(res.status).toBe(401);
  });

  it('returns 422 with empty requisitionIds array', async () => {
    const res = await request(app)
      .post('/api/v1/triage/run-batch')
      .set('X-API-Key', API_KEY)
      .send({ requisitionIds: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 with non-UUID in requisitionIds', async () => {
    const res = await request(app)
      .post('/api/v1/triage/run-batch')
      .set('X-API-Key', API_KEY)
      .send({ requisitionIds: ['not-a-uuid'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when requisitionIds exceeds 50 items', async () => {
    const ids = Array.from({ length: 51 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
    );
    const res = await request(app)
      .post('/api/v1/triage/run-batch')
      .set('X-API-Key', API_KEY)
      .send({ requisitionIds: ids });
    expect(res.status).toBe(422);
  });

  it('returns batch result with succeeded and failed counts', async () => {
    const pr1 = await seedRequisition('0010099010');
    const pr2 = await seedRequisition('0010099011');
    const unknownId = '00000000-0000-0000-0000-000000000099';

    const res = await request(app)
      .post('/api/v1/triage/run-batch')
      .set('X-API-Key', API_KEY)
      .send({ requisitionIds: [pr1.id, pr2.id, unknownId] });

    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(2);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results).toHaveLength(3);
    const failed = res.body.data.results.find(
      (r: { requisitionId: string }) => r.requisitionId === unknownId,
    );
    expect(failed?.status).toBe('rejected');
  });
});

describe('GET /api/v1/triage/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyze.mockResolvedValue(VALID_AI_RESULT);
  });

  it('returns 404 when no triage result exists for the PR', async () => {
    const pr = await seedRequisition('0010099020');
    const res = await request(app)
      .get(`/api/v1/triage/${pr.id}`)
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns stored triage result after running triage', async () => {
    const pr = await seedRequisition('0010099021');
    await request(app).post(`/api/v1/triage/run/${pr.id}`).set('X-API-Key', API_KEY);
    const res = await request(app).get(`/api/v1/triage/${pr.id}`).set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.requisitionId).toBe(pr.id);
    expect(res.body.data.riskScore).toBe(45);
  });
});

describe('POST /api/v1/triage/webhook/triage-complete', () => {
  it('returns 401 without API key (rejected by authMiddleware before reaching webhook handler)', async () => {
    const res = await request(app)
      .post('/api/v1/triage/webhook/triage-complete')
      .set('X-N8N-Webhook-Secret', N8N_SECRET);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 without webhook secret', async () => {
    const res = await request(app)
      .post('/api/v1/triage/webhook/triage-complete')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with wrong webhook secret', async () => {
    const res = await request(app)
      .post('/api/v1/triage/webhook/triage-complete')
      .set('X-API-Key', API_KEY)
      .set('X-N8N-Webhook-Secret', 'definitely-wrong-secret');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with valid API key and correct webhook secret', async () => {
    const res = await request(app)
      .post('/api/v1/triage/webhook/triage-complete')
      .set('X-API-Key', API_KEY)
      .set('X-N8N-Webhook-Secret', N8N_SECRET);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body).toHaveProperty('timestamp');
  });
});
