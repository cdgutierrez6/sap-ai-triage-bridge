import type { Request, Response, NextFunction } from 'express';
import { env } from '../../../config/env';
import { AppError } from './error.middleware';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== env.API_KEY) {
    next(new AppError('UNAUTHORIZED', 'Invalid or missing API key', 401));
    return;
  }
  next();
}
