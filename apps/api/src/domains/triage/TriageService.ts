import type { PrismaClient } from '@prisma/client';
import type { AIProvider } from './providers/AIProvider.interface';
import type { TriageResult } from '@sap-triage/shared';
import { getRiskLevel } from '@sap-triage/shared';
import { AppError } from '../../infrastructure/http/middleware/error.middleware';
import { logger } from '../../config/logger';

export class TriageService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aiProvider: AIProvider,
  ) {}

  async runTriage(requisitionId: string): Promise<TriageResult> {
    const pr = await this.prisma.purchaseRequisition.findUnique({
      where: { id: requisitionId },
      include: { items: true },
    });

    if (!pr) {
      throw new AppError('NOT_FOUND', `Purchase Requisition ${requisitionId} not found`, 404);
    }

    const sapPr = JSON.parse(JSON.stringify(pr.rawSapPayload)) as import('@sap-triage/shared').SapPurchaseRequisition;

    const startMs = Date.now();

    let providerResult: Awaited<ReturnType<AIProvider['analyze']>>;
    try {
      providerResult = await this.aiProvider.analyze(sapPr);
    } catch (err) {
      logger.error({ err, requisitionId }, 'AI provider error during triage');
      if (err instanceof AppError) throw err;
      throw new AppError('AI_PROVIDER_ERROR', 'AI provider failed to analyze the requisition', 502);
    }

    const processingTimeMs = Date.now() - startMs;
    const { output, model, promptTokens, completionTokens } = providerResult;
    const riskLevel = getRiskLevel(output.riskScore);

    const saved = await this.prisma.triageResult.upsert({
      where: { requisitionId },
      create: {
        requisitionId,
        riskScore: output.riskScore,
        riskLevel,
        spendCategory: output.spendCategory,
        budgetType: output.budgetType,
        anomalies: output.anomalies,
        aiSummary: output.aiSummary,
        recommendations: output.recommendations,
        aiProvider: this.aiProvider.name,
        aiModel: model,
        promptTokens,
        completionTokens,
        processingTimeMs,
        triagedAt: new Date(),
      },
      update: {
        riskScore: output.riskScore,
        riskLevel,
        spendCategory: output.spendCategory,
        budgetType: output.budgetType,
        anomalies: output.anomalies,
        aiSummary: output.aiSummary,
        recommendations: output.recommendations,
        aiProvider: this.aiProvider.name,
        aiModel: model,
        promptTokens,
        completionTokens,
        processingTimeMs,
        triagedAt: new Date(),
      },
    });

    return this.mapToTriageResult(saved);
  }

  async getTriageResult(requisitionId: string): Promise<TriageResult | null> {
    const result = await this.prisma.triageResult.findUnique({
      where: { requisitionId },
    });
    return result ? this.mapToTriageResult(result) : null;
  }

  private mapToTriageResult(record: import('@prisma/client').TriageResult): TriageResult {
    return {
      id: record.id,
      requisitionId: record.requisitionId,
      riskScore: record.riskScore,
      riskLevel: record.riskLevel as TriageResult['riskLevel'],
      spendCategory: record.spendCategory,
      budgetType: record.budgetType as TriageResult['budgetType'],
      anomalies: record.anomalies as TriageResult['anomalies'],
      aiSummary: record.aiSummary,
      recommendations: record.recommendations as string[],
      aiProvider: record.aiProvider,
      aiModel: record.aiModel,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      processingTimeMs: record.processingTimeMs,
      triagedAt: record.triagedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
