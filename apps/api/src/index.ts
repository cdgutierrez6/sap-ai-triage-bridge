import './config/env'; // validates env vars before anything else
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { prisma } from './infrastructure/database/prisma.client';
import { SapClientFactory } from './infrastructure/sap/SapClientFactory';
import { AIProviderFactory } from './domains/triage/providers/AIProviderFactory';
import { TriageService } from './domains/triage/TriageService';
import { SyncService } from './sync/SyncService';
import { createRequisitionsRouter } from './infrastructure/http/routes/requisitions.routes';
import { createTriageRouter } from './infrastructure/http/routes/triage.routes';
import { createSyncRouter } from './infrastructure/http/routes/sync.routes';
import { createHealthRouter } from './infrastructure/http/routes/health.routes';
import { authMiddleware } from './infrastructure/http/middleware/auth.middleware';
import { requestIdMiddleware } from './infrastructure/http/middleware/requestId.middleware';
import { errorMiddleware, notFoundMiddleware } from './infrastructure/http/middleware/error.middleware';
import { logger } from './config/logger';
import { env } from './config/env';

const app = express();

const sapClient = SapClientFactory.create(env.SAP_MODE);
const aiProvider = AIProviderFactory.create(env.AI_PROVIDER);
const triageService = new TriageService(prisma, aiProvider);
const syncService = new SyncService(sapClient, prisma);

app.use(cors({
  origin: (env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'DELETE'],
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);
app.use(pinoHttp({ logger }));

// HTTP security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

const triageRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' } },
});

const syncRateLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Sync rate limit exceeded: max 10/hour' } },
});

app.use('/api/v1/health', createHealthRouter(prisma, sapClient));
app.use('/api/v1/requisitions', authMiddleware, createRequisitionsRouter(prisma));
app.use('/api/v1/triage', authMiddleware, triageRateLimiter, createTriageRouter(triageService));
app.use('/api/v1/sync', authMiddleware, syncRateLimiter, createSyncRouter(syncService, prisma));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const port = parseInt(env.PORT, 10);
app.listen(port, () => {
  logger.info(`🚀 SAP AI Triage Bridge API running on port ${port}`);
  logger.info(`   SAP Mode:    ${env.SAP_MODE.toUpperCase()}`);
  logger.info(`   AI Provider: ${env.AI_PROVIDER}`);
  logger.info(`   Environment: ${env.NODE_ENV}`);
});

export default app;
