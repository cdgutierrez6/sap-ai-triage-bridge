import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { SapODataClientInterface } from '../../sap/SapODataClient.interface';
import type { HealthResponse } from '@sap-triage/shared';
import { env } from '../../../config/env';

export function createHealthRouter(prisma: PrismaClient, sapClient: SapODataClientInterface): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {}

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

  router.get('/sap', async (_req: Request, res: Response) => {
    const result = await sapClient.testConnectivity();
    res.status(result.connected ? 200 : 503).json(result);
  });

  return router;
}
