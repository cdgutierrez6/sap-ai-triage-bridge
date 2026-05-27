import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { TriageService } from '../../../domains/triage/TriageService';
import { AppError } from '../middleware/error.middleware';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

// Strict UUID v4 pattern — prevents loose matches like "----...----" (36 dashes)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createTriageRouter(triageService: TriageService): Router {
  const router = Router();

  router.post('/run/:requisitionId', async (req: Request, res: Response, next: NextFunction) => {
    const requisitionId = req.params.requisitionId as string;
    if (!UUID_REGEX.test(requisitionId)) {
      next(new AppError('VALIDATION_ERROR', 'Invalid requisitionId format', 422));
      return;
    }

    const result = await triageService.runTriage(requisitionId).catch(next);
    if (result) res.json({ data: result });
  });

  router.post('/run-batch', async (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({ requisitionIds: z.array(z.string().uuid()).min(1).max(50) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError('VALIDATION_ERROR', 'requisitionIds must be an array of UUIDs (max 50)', 422, 'requisitionIds'));
      return;
    }

    const results = await Promise.allSettled(parsed.data.requisitionIds.map((id) => triageService.runTriage(id)));

    // Log failures server-side before sanitizing the response — never forward raw error.message to client (BLOCKER-05)
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.error(
          { err: r.reason, requisitionId: parsed.data.requisitionIds[i] },
          '[TriageBatch] item failed',
        );
      }
    });

    res.json({
      data: {
        succeeded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        results: results.map((r, i) => ({
          requisitionId: parsed.data.requisitionIds[i],
          status: r.status,
          ...(r.status === 'fulfilled' ? { triage: r.value } : { error: 'Triage failed for this requisition' }),
        })),
      },
    });
  });

  router.get('/:requisitionId', async (req: Request, res: Response, next: NextFunction) => {
    const requisitionId = req.params.requisitionId as string;
    if (!UUID_REGEX.test(requisitionId)) {
      next(new AppError('VALIDATION_ERROR', 'Invalid requisitionId format', 422));
      return;
    }

    const result = await triageService.getTriageResult(requisitionId);
    if (!result) {
      next(new AppError('NOT_FOUND', `No triage result for requisition ${requisitionId}`, 404));
      return;
    }
    res.json({ data: result });
  });

  router.post('/webhook/triage-complete', (req: Request, res: Response, next: NextFunction) => {
    const secret = req.headers['x-n8n-webhook-secret'];
    if (!env.N8N_WEBHOOK_SECRET || secret !== env.N8N_WEBHOOK_SECRET) {
      next(new AppError('UNAUTHORIZED', 'Invalid webhook secret', 401));
      return;
    }
    res.json({ received: true, timestamp: new Date().toISOString() });
  });

  return router;
}
