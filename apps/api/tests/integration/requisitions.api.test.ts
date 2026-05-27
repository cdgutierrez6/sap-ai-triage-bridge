import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from './setup';

const API_KEY = process.env.API_KEY ?? 'test-api-key-min-32-characters-here';

let seqCounter = 1;

async function seedRequisition(overrides: {
  purchaseRequisition?: string;
  processingStatus?: string;
  creationDate?: Date;
} = {}) {
  const seq = String(seqCounter++).padStart(4, '0');
  return prisma.purchaseRequisition.create({
    data: {
      purchaseRequisition: overrides.purchaseRequisition ?? `00100990${seq}`,
      purchaseRequisitionType: 'NB',
      description: 'Test PR for integration tests',
      companyCode: '1000',
      createdByUser: 'TESTUSER',
      creationDate: overrides.creationDate ?? new Date('2026-05-01'),
      lastChangeDateTime: new Date(),
      processingStatus: overrides.processingStatus ?? '01',
      rawSapPayload: { PurchaseRequisition: overrides.purchaseRequisition ?? `00100990${seq}` },
      sandboxMode: true,
      syncedAt: new Date(),
    },
  });
}

describe('GET /api/v1/health', () => {
  it('returns 200 with status and timestamp (no internal details)', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    // Public endpoint intentionally omits sapMode and aiProvider
    expect(res.body).not.toHaveProperty('sapMode');
    expect(res.body).not.toHaveProperty('aiProvider');
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

  // --- Date filter regression tests (cover refactored dateFilter in requisitions.routes.ts) ---

  it('filters by startDate — returns only PRs on or after the date', async () => {
    await seedRequisition({ creationDate: new Date('2026-03-15') });
    const res = await request(app)
      .get('/api/v1/requisitions?startDate=2026-01-01')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const pr of res.body.data as Array<{ creationDate: string }>) {
      expect(new Date(pr.creationDate).getTime()).toBeGreaterThanOrEqual(new Date('2026-01-01').getTime());
    }
  });

  it('filters by startDate — returns empty when startDate is after all PRs', async () => {
    await seedRequisition({ creationDate: new Date('2026-03-15') });
    const res = await request(app)
      .get('/api/v1/requisitions?startDate=2027-01-01')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('filters by endDate — returns only PRs on or before the date', async () => {
    await seedRequisition({ creationDate: new Date('2026-03-15') });
    const res = await request(app)
      .get('/api/v1/requisitions?endDate=2026-12-31')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('filters by endDate — returns empty when endDate is before all PRs', async () => {
    await seedRequisition({ creationDate: new Date('2026-03-15') });
    const res = await request(app)
      .get('/api/v1/requisitions?endDate=2025-12-31')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('filters by combined startDate + endDate range', async () => {
    await seedRequisition({ creationDate: new Date('2026-03-15') });
    const inRange = await request(app)
      .get('/api/v1/requisitions?startDate=2026-01-01&endDate=2026-12-31')
      .set('X-API-Key', API_KEY);
    const outOfRange = await request(app)
      .get('/api/v1/requisitions?startDate=2027-01-01&endDate=2027-12-31')
      .set('X-API-Key', API_KEY);
    expect(inRange.status).toBe(200);
    expect(inRange.body.data.length).toBeGreaterThan(0);
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body.data).toHaveLength(0);
  });

  it('filters by status', async () => {
    await seedRequisition({ processingStatus: '01' });
    await seedRequisition({ processingStatus: 'N2' });
    const res = await request(app)
      .get('/api/v1/requisitions?status=01')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    for (const pr of res.body.data as Array<{ processingStatus: string }>) {
      expect(pr.processingStatus).toBe('01');
    }
  });
});

describe('GET /api/v1/requisitions/:id', () => {
  // Regression test for GAP-002: non-UUID id must return 422, not 500
  it('returns 422 for non-UUID id (no Prisma error leaks)', async () => {
    const res = await request(app)
      .get('/api/v1/requisitions/not-a-valid-uuid')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // Must not expose internal Prisma error details
    expect(JSON.stringify(res.body)).not.toContain('invalid input syntax');
  });

  it('returns 404 for unknown UUID', async () => {
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
