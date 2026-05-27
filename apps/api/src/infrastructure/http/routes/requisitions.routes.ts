import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { RequisitionListItem, RequisitionDetail, PaginatedResponse } from '@sap-triage/shared';
import { AppError } from '../middleware/error.middleware';

const filterSchema = z.object({
  status: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  plant: z.string().optional(),
  materialGroup: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function createRequisitionsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = filterSchema.safeParse(req.query);
    if (!parsed.success) {
      next(new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query params', 422));
      return;
    }

    const { status, riskLevel, plant, startDate, endDate, search, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PurchaseRequisitionWhereInput = {};
    if (status) where.processingStatus = status;
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    if (startDate || endDate) where.creationDate = dateFilter;
    if (search) {
      where.OR = [
        { purchaseRequisition: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (plant) {
      where.items = { some: { plant } };
    }

    const triageWhere = riskLevel ? { triageResult: { riskLevel } } : {};

    const [total, records] = await Promise.all([
      prisma.purchaseRequisition.count({ where: { ...where, ...triageWhere } }),
      prisma.purchaseRequisition.findMany({
        where: { ...where, ...triageWhere },
        include: {
          items: { select: { documentCurrency: true, totalPrice: true } },
          triageResult: {
            select: { riskScore: true, riskLevel: true, spendCategory: true, budgetType: true, triagedAt: true },
          },
        },
        orderBy: { creationDate: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const sandboxMode = records[0]?.sandboxMode ?? true;

    const data: RequisitionListItem[] = records.map((r) => {
      const totalValue = r.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
      const currency = r.items[0]?.documentCurrency ?? null;
      return {
        id: r.id,
        purchaseRequisition: r.purchaseRequisition,
        purchaseRequisitionType: r.purchaseRequisitionType,
        description: r.description,
        companyCode: r.companyCode,
        createdByUser: r.createdByUser,
        creationDate: r.creationDate.toISOString().split('T')[0]!,
        processingStatus: r.processingStatus as RequisitionListItem['processingStatus'],
        sandboxMode: r.sandboxMode,
        syncedAt: r.syncedAt.toISOString(),
        itemCount: r.items.length,
        totalValue: totalValue || null,
        currency,
        triage: r.triageResult
          ? {
              riskScore: r.triageResult.riskScore,
              riskLevel: r.triageResult.riskLevel as 'low' | 'medium' | 'high' | 'critical',
              spendCategory: r.triageResult.spendCategory,
              budgetType: r.triageResult.budgetType,
              triagedAt: r.triageResult.triagedAt.toISOString(),
            }
          : null,
      };
    });

    const response: PaginatedResponse<RequisitionListItem> = {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        sandboxMode,
      },
    };

    res.json(response);
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;

    // Validate UUID format before DB call — prevents Prisma from throwing P2023
    // and leaking "invalid input syntax for type uuid" in the error response
    if (!id?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      next(new AppError('VALIDATION_ERROR', 'id must be a valid UUID', 422, 'id'));
      return;
    }

    const record = await prisma.purchaseRequisition.findUnique({
      where: { id },
      include: {
        items: true,
        triageResult: true,
      },
    });

    if (!record) {
      next(new AppError('NOT_FOUND', `Purchase Requisition ${id} not found`, 404));
      return;
    }

    const totalValue = record.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    const currency = record.items[0]?.documentCurrency ?? null;

    const detail: RequisitionDetail = {
      id: record.id,
      purchaseRequisition: record.purchaseRequisition,
      purchaseRequisitionType: record.purchaseRequisitionType,
      description: record.description,
      companyCode: record.companyCode,
      createdByUser: record.createdByUser,
      creationDate: record.creationDate.toISOString().split('T')[0]!,
      lastChangeDateTime: record.lastChangeDateTime.toISOString(),
      processingStatus: record.processingStatus as RequisitionDetail['processingStatus'],
      sandboxMode: record.sandboxMode,
      syncedAt: record.syncedAt.toISOString(),
      rawSapPayload: record.rawSapPayload,
      itemCount: record.items.length,
      totalValue: totalValue || null,
      currency,
      items: record.items.map((item) => ({
        id: item.id,
        purchaseRequisitionItem: item.purchaseRequisitionItem,
        purchReqnItemCategory: item.purchReqnItemCategory,
        accountAssignmentCategory: item.accountAssignmentCategory,
        shortText: item.shortText,
        material: item.material,
        materialGroup: item.materialGroup,
        plant: item.plant,
        storageLocation: item.storageLocation,
        requestedQuantity: item.requestedQuantity ? Number(item.requestedQuantity) : null,
        requestedQuantityUnit: item.requestedQuantityUnit,
        priceInDocumentCurrency: item.priceInDocumentCurrency ? Number(item.priceInDocumentCurrency) : null,
        documentCurrency: item.documentCurrency,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
        deliveryDate: item.deliveryDate ? item.deliveryDate.toISOString().split('T')[0]! : null,
        purchasingGroup: item.purchasingGroup,
        purchasingOrganization: item.purchasingOrganization,
        requisitioner: item.requisitioner,
        supplier: item.supplier,
        itemProcessingStatus: item.itemProcessingStatus,
      })),
      triage: record.triageResult
        ? {
            id: record.triageResult.id,
            requisitionId: record.triageResult.requisitionId,
            riskScore: record.triageResult.riskScore,
            riskLevel: record.triageResult.riskLevel as 'low' | 'medium' | 'high' | 'critical',
            spendCategory: record.triageResult.spendCategory,
            budgetType: record.triageResult.budgetType as 'CAPEX' | 'OPEX' | 'UNKNOWN',
            anomalies: record.triageResult.anomalies as unknown as import('@sap-triage/shared').Anomaly[],
            aiSummary: record.triageResult.aiSummary,
            recommendations: record.triageResult.recommendations as string[],
            aiProvider: record.triageResult.aiProvider,
            aiModel: record.triageResult.aiModel,
            promptTokens: record.triageResult.promptTokens,
            completionTokens: record.triageResult.completionTokens,
            processingTimeMs: record.triageResult.processingTimeMs,
            triagedAt: record.triageResult.triagedAt.toISOString(),
            createdAt: record.triageResult.createdAt.toISOString(),
            updatedAt: record.triageResult.updatedAt.toISOString(),
          }
        : null,
    };

    res.json({ data: detail });
  });

  return router;
}
