import { timingSafeEqual, createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../../../config/env';
import { AppError } from './error.middleware';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    next(new AppError('UNAUTHORIZED', 'Invalid or missing API key', 401));
    return;
  }
  const received = createHash('sha256').update(apiKey).digest();
  const expected = createHash('sha256').update(env.API_KEY).digest();
  if (!timingSafeEqual(received, expected)) {
    next(new AppError('UNAUTHORIZED', 'Invalid or missing API key', 401));
    return;
  }
  next();
}
