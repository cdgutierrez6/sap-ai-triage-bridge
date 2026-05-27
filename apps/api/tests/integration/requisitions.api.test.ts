import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from './setup';

const API_KEY = process.env.API_KEY ?? 'test-api-key-min-32-characters-here';

async function seedRequisition() {
  return prisma.purchaseRequisition.create({
    data: {
      purchaseRequisition: '0010099001',
      purchaseRequisitionType: 'NB',
      description: 'Test PR for integration tests',
      companyCode: '1000',
      createdByUser: 'TESTUSER',
      creationDate: new Date('2026-05-01'),
      lastChangeDateTime: new Date(),
      processingStatus: '01',
      rawSapPayload: { PurchaseRequisition: '0010099001' },
      sandboxMode: true,
      syncedAt: new Date(),
    },
  });
}

describe('GET /api/v1/health', () => {
  it('returns 200 with health status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('sapMode');
  });
});

describe('GET /api/v1/requisitions', () => {
  it('returns 401 without API key', async () => {
    const res = await request(app).get('/api/v1/requisitions');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns paginated list with valid API key', async () => {
    await seedRequisition();
    const res = await request(app).get('/api/v1/requisitions').set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('sandboxMode');
  });

  it('returns 422 with invalid riskLevel filter', async () => {
    const res = await request(app)
      .get('/api/v1/requisitions?riskLevel=invalid')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/requisitions/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/v1/requisitions/00000000-0000-0000-0000-000000000000')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns PR detail with items and triage null when not triaged', async () => {
    const pr = await seedRequisition();
    const res = await request(app)
      .get(`/api/v1/requisitions/${pr.id}`)
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(pr.id);
    expect(res.body.data.triage).toBeNull();
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});
