import { Router, type Request, type Response } from 'express';
import type { SyncService } from '../../../sync/SyncService';
import type { PrismaClient } from '@prisma/client';

export function createSyncRouter(syncService: SyncService, prisma: PrismaClient): Router {
  const router = Router();

  router.post('/trigger', async (_req: Request, res: Response) => {
    const result = await syncService.sync();
    res.json({ data: result });
  });

  router.get('/logs', async (_req: Request, res: Response) => {
    const logs = await prisma.syncLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 50,
    });
    res.json({ data: logs });
  });

  return router;
}
