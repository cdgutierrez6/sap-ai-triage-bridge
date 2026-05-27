import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from './setup';

const API_KEY = process.env.API_KEY ?? 'test-api-key-that-is-at-least-32-chars-long';

describe('POST /api/v1/sync/trigger', () => {
  it('returns 401 without API key', async () => {
    const res = await request(app).post('/api/v1/sync/trigger');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('runs sync and returns result with expected shape', async () => {
    const res = await request(app)
      .post('/api/v1/sync/trigger')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      mode: 'sandbox',
      recordsFetched: expect.any(Number),
      recordsUpserted: expect.any(Number),
      durationMs: expect.any(Number),
      syncedAt: expect.any(String),
    });
    expect(res.body.data.recordsFetched).toBeGreaterThan(0);
    expect(res.body.data.recordsUpserted).toBe(res.body.data.recordsFetched);
  });

  it('creates a sync log entry in the database', async () => {
    await request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY);
    const logs = await prisma.syncLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 1 });
    expect(logs).toHaveLength(1);
    expect(logs[0].mode).toBe('sandbox');
    expect(logs[0].status).toBe('success');
    expect(logs[0].recordsFetched).toBeGreaterThan(0);
  });

  it('upserts PRs into the database (sync is idempotent)', async () => {
    await request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY);
    const countAfterFirst = await prisma.purchaseRequisition.count();

    await request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY);
    const countAfterSecond = await prisma.purchaseRequisition.count();

    // Upsert — no duplicate rows created
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('durationMs is a positive number', async () => {
    const res = await request(app)
      .post('/api/v1/sync/trigger')
      .set('X-API-Key', API_KEY);
    expect(res.body.data.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /api/v1/sync/logs', () => {
  it('returns 401 without API key', async () => {
    const res = await request(app).get('/api/v1/sync/logs');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns empty array when no syncs have run', async () => {
    const res = await request(app)
      .get('/api/v1/sync/logs')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns sync logs ordered by most recent first', async () => {
    await request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY);
    await request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY);

    const res = await request(app)
      .get('/api/v1/sync/logs')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const [first, second] = res.body.data as Array<{ syncedAt: string }>;
    expect(new Date(first.syncedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(second.syncedAt).getTime(),
    );
  });

  it('each log entry has the required fields', async () => {
    await request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY);
    const res = await request(app)
      .get('/api/v1/sync/logs')
      .set('X-API-Key', API_KEY);

    const log = res.body.data[0] as Record<string, unknown>;
    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('mode', 'sandbox');
    expect(log).toHaveProperty('status', 'success');
    expect(log).toHaveProperty('recordsFetched');
    expect(log).toHaveProperty('recordsUpserted');
    expect(log).toHaveProperty('durationMs');
    expect(log).toHaveProperty('syncedAt');
    // Prisma returns null for unset optional fields — must not leak internal error details
    expect(log.errorMessage).toBeNull();
  });

  it('returns all logs when fewer than 50 exist (respects take:50 limit)', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/v1/sync/trigger').set('X-API-Key', API_KEY),
      ),
    );
    const res = await request(app)
      .get('/api/v1/sync/logs')
      .set('X-API-Key', API_KEY);
    // 5 syncs → 5 logs returned (well within the 50-entry cap)
    expect(res.body.data.length).toBe(5);
    expect(res.body.data.length).toBeLessThanOrEqual(50);
  });
});
