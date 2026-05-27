import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { logger } from '../../../config/logger';

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  SAP_CONNECTION_ERROR: 'SAP_CONNECTION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorMiddleware: ErrorRequestHandler = (err, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.field && { field: err.field }),
        ...(requestId && { requestId }),
      },
    });
    return;
  }

  logger.error({ err, requestId, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      ...(requestId && { requestId }),
    },
  });
};

export const notFoundMiddleware = (_req: Request, res: Response) => {
  res.status(404).json({
    error: { code: ErrorCodes.NOT_FOUND, message: 'Route not found' },
  });
};
