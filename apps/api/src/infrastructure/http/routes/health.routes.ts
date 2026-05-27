import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { SapODataClientInterface } from '../../sap/SapODataClient.interface';
import type { HealthResponse } from '@sap-triage/shared';
import { authMiddleware } from '../middleware/auth.middleware';
import { env } from '../../../config/env';

export function createHealthRouter(prisma: PrismaClient, sapClient: SapODataClientInterface): Router {
  const router = Router();

  async function checkDb(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // Public — only status, no internal details
  router.get('/', async (_req: Request, res: Response) => {
    const dbConnected = await checkDb();
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    });
  });

  // Authenticated — full details for internal monitoring
  router.get('/detailed', authMiddleware, async (_req: Request, res: Response) => {
    const dbConnected = await checkDb();
    const response: HealthResponse = {
      status: dbConnected ? 'ok' : 'degraded',
      dbConnected,
      aiProvider: env.AI_PROVIDER,
      sapMode: env.SAP_MODE,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
    res.status(dbConnected ? 200 : 503).json(response);
  });

  // Authenticated — SAP connectivity test
  router.get('/sap', authMiddleware, async (_req: Request, res: Response) => {
    const result = await sapClient.testConnectivity();
    res.status(result.connected ? 200 : 503).json(result);
  });

  return router;
}
