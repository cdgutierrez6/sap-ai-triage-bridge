import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be mocked before the middleware import so env is resolved correctly
vi.mock('../../src/config/env', () => ({
  env: {
    API_KEY: 'test-api-key-that-is-at-least-32-chars-long',
    NODE_ENV: 'test',
    PORT: '3001',
    AI_PROVIDER: 'claude',
    SAP_MODE: 'sandbox',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    ANTHROPIC_API_KEY: 'sk-ant-test-placeholder',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/sap_triage_test',
  },
}));

import { authMiddleware } from '../../src/infrastructure/http/middleware/auth.middleware';
import type { Request, Response, NextFunction } from 'express';

const VALID_KEY = 'test-api-key-that-is-at-least-32-chars-long';
const WRONG_KEY = 'wrong-api-key-that-is-at-least-32-chars!!!!';

function makeReq(headers: Record<string, string | string[]> = {}): Request {
  return { headers } as unknown as Request;
}

const mockRes = {} as Response;

describe('authMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next() with no arguments on valid X-API-Key', () => {
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(makeReq({ 'x-api-key': VALID_KEY }), mockRes, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(/* nothing */);
  });

  it('calls next(AppError 401) when X-API-Key header is absent', () => {
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(makeReq({}), mockRes, next);
    const [err] = next.mock.calls[0] as [{ code: string; statusCode: number }];
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });

  it('calls next(AppError 401) when X-API-Key is wrong', () => {
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(makeReq({ 'x-api-key': WRONG_KEY }), mockRes, next);
    const [err] = next.mock.calls[0] as [{ code: string; statusCode: number }];
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });

  it('returns identical error message for missing vs wrong key (no timing info leak)', () => {
    const nextMissing = vi.fn() as unknown as NextFunction;
    const nextWrong = vi.fn() as unknown as NextFunction;
    authMiddleware(makeReq({}), mockRes, nextMissing);
    authMiddleware(makeReq({ 'x-api-key': WRONG_KEY }), mockRes, nextWrong);
    const errMissing = (nextMissing.mock.calls[0] as [Error])[0];
    const errWrong = (nextWrong.mock.calls[0] as [Error])[0];
    expect(errMissing.message).toBe(errWrong.message);
  });

  it('rejects array header value (header injection attempt)', () => {
    const next = vi.fn() as unknown as NextFunction;
    // Express parses duplicate headers as arrays; authMiddleware must reject non-strings
    authMiddleware(makeReq({ 'x-api-key': [VALID_KEY, 'injected'] }), mockRes, next);
    const [err] = next.mock.calls[0] as [{ code: string }];
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('calls next() exactly once on valid key (no double-invocation)', () => {
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(makeReq({ 'x-api-key': VALID_KEY }), mockRes, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
