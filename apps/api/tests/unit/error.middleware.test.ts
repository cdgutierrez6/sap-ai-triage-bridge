import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import {
  errorMiddleware,
  notFoundMiddleware,
  AppError,
} from '../../src/infrastructure/http/middleware/error.middleware';
import type { Request, Response, NextFunction } from 'express';

function makeReq(headers: Record<string, string> = {}, path = '/test'): Request {
  return { headers, path } as unknown as Request;
}

function makeRes() {
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  return { status: statusFn, _json: jsonFn } as unknown as Response & { _json: typeof jsonFn };
}

function captureBody(res: ReturnType<typeof makeRes>) {
  const mock = res as unknown as { status: ReturnType<typeof vi.fn>; _json: ReturnType<typeof vi.fn> };
  return (mock.status.mock.results[0].value as { json: ReturnType<typeof vi.fn> }).json.mock.calls[0][0] as Record<string, unknown>;
}

const noop = vi.fn() as unknown as NextFunction;

beforeEach(() => vi.clearAllMocks());

describe('AppError', () => {
  it('stores code, message, statusCode, and field', () => {
    const err = new AppError('NOT_FOUND', 'Resource missing', 404, 'id');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource missing');
    expect(err.statusCode).toBe(404);
    expect(err.field).toBe('id');
    expect(err.name).toBe('AppError');
    expect(err instanceof Error).toBe(true);
  });

  it('defaults statusCode to 400 when omitted', () => {
    const err = new AppError('VALIDATION_ERROR', 'bad input');
    expect(err.statusCode).toBe(400);
    expect(err.field).toBeUndefined();
  });
});

describe('errorMiddleware — AppError handling', () => {
  it('responds with the AppError statusCode and error code', () => {
    const res = makeRes();
    errorMiddleware(new AppError('NOT_FOUND', 'Not found', 404), makeReq(), res, noop);
    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(404);
    const body = captureBody(res);
    expect((body.error as Record<string, unknown>).code).toBe('NOT_FOUND');
    expect((body.error as Record<string, unknown>).message).toBe('Not found');
  });

  it('includes field when AppError has one', () => {
    const res = makeRes();
    errorMiddleware(new AppError('VALIDATION_ERROR', 'Invalid value', 422, 'email'), makeReq(), res, noop);
    const body = captureBody(res);
    expect((body.error as Record<string, unknown>).field).toBe('email');
  });

  it('omits field key when AppError has none', () => {
    const res = makeRes();
    errorMiddleware(new AppError('NOT_FOUND', 'Not found', 404), makeReq(), res, noop);
    const body = captureBody(res);
    expect((body.error as Record<string, unknown>)).not.toHaveProperty('field');
  });

  it('includes requestId from X-Request-Id header', () => {
    const res = makeRes();
    errorMiddleware(
      new AppError('UNAUTHORIZED', 'Denied', 401),
      makeReq({ 'x-request-id': 'req-abc-123' }),
      res,
      noop,
    );
    const body = captureBody(res);
    expect((body.error as Record<string, unknown>).requestId).toBe('req-abc-123');
  });
});

describe('errorMiddleware — unknown error handling', () => {
  it('returns 500 INTERNAL_ERROR for plain Error', () => {
    const res = makeRes();
    errorMiddleware(new Error('something crashed'), makeReq(), res, noop);
    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(500);
    const body = captureBody(res);
    expect((body.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR');
    expect((body.error as Record<string, unknown>).message).toBe('An unexpected error occurred');
  });

  it('does not expose raw error message to the client', () => {
    const res = makeRes();
    errorMiddleware(new Error('DB password: hunter2'), makeReq(), res, noop);
    const body = captureBody(res);
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('does not expose stack traces to the client', () => {
    const err = new Error('oops');
    err.stack = 'Error: oops\n  at Module.load (/app/src/secret.ts:42:5)';
    const res = makeRes();
    errorMiddleware(err, makeReq(), res, noop);
    const body = captureBody(res);
    expect(JSON.stringify(body)).not.toContain('secret.ts');
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});

describe('notFoundMiddleware', () => {
  it('returns 404 with NOT_FOUND error code', () => {
    const jsonFn = vi.fn();
    const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
    const res = { status: statusFn } as unknown as Response;
    notFoundMiddleware({} as Request, res);
    expect(statusFn).toHaveBeenCalledWith(404);
    const body = jsonFn.mock.calls[0][0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });
});
