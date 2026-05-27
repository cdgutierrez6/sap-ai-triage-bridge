import type { PrismaClient } from '@prisma/client';
import type { SapODataClientInterface } from '../infrastructure/sap/SapODataClient.interface';
import type { SapPurchaseRequisition } from '@sap-triage/shared';
import type { SyncResult } from '@sap-triage/shared';
import { logger } from '../config/logger';

export class SyncService {
  constructor(
    private readonly sapClient: SapODataClientInterface,
    private readonly prisma: PrismaClient,
  ) {}

  async sync(): Promise<SyncResult> {
    const startMs = Date.now();
    let recordsFetched = 0;
    let recordsUpserted = 0;
    let syncStatus: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;

    try {
      const requisitions = await this.sapClient.fetchPurchaseRequisitions();
      recordsFetched = requisitions.length;

      for (const pr of requisitions) {
        await this.upsertRequisition(pr);
        recordsUpserted++;
      }
    } catch (err) {
      syncStatus = 'error';
      errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
      logger.error({ err }, 'Sync failed');
    }

    const durationMs = Date.now() - startMs;
    const syncedAt = new Date();

    await this.prisma.syncLog.create({
      data: {
        mode: this.sapClient.mode,
        status: syncStatus,
        recordsFetched,
        recordsUpserted,
        errorMessage,
        durationMs,
        syncedAt,
      },
    });

    return {
      mode: this.sapClient.mode,
      recordsFetched,
      recordsUpserted,
      durationMs,
      syncedAt: syncedAt.toISOString(),
    };
  }

  private async upsertRequisition(pr: SapPurchaseRequisition): Promise<void> {
    const isSandbox = this.sapClient.mode === 'sandbox';

    await this.prisma.$transaction(async (tx) => {
      const header = await tx.purchaseRequisition.upsert({
        where: { purchaseRequisition: pr.PurchaseRequisition },
        create: {
          purchaseRequisition: pr.PurchaseRequisition,
          purchaseRequisitionType: pr.PurchaseRequisitionType,
          description: pr.PurReqnDescription,
          companyCode: pr.CompanyCode,
          createdByUser: pr.CreatedByUser,
          creationDate: new Date(pr.CreationDate),
          lastChangeDateTime: new Date(pr.LastChangeDateTime),
          processingStatus: pr.ProcessingStatus,
          rawSapPayload: pr as object,
          sandboxMode: isSandbox,
          syncedAt: new Date(),
        },
        update: {
          purchaseRequisitionType: pr.PurchaseRequisitionType,
          description: pr.PurReqnDescription,
          processingStatus: pr.ProcessingStatus,
          lastChangeDateTime: new Date(pr.LastChangeDateTime),
          rawSapPayload: pr as object,
          syncedAt: new Date(),
        },
      });

      await tx.purchaseRequisitionItem.deleteMany({
        where: { requisitionId: header.id },
      });

      if (pr.to_PurchaseReqnItem.length > 0) {
        await tx.purchaseRequisitionItem.createMany({
          data: pr.to_PurchaseReqnItem.map((item) => ({
            requisitionId: header.id,
            purchaseRequisition: item.PurchaseRequisition,
            purchaseRequisitionItem: item.PurchaseRequisitionItem,
            purchReqnItemCategory: item.PurchReqnItemCategory,
            accountAssignmentCategory: item.AccountAssignmentCategory,
            shortText: item.PurchasingDocumentItemText,
            material: item.Material,
            materialGroup: item.MaterialGroup,
            plant: item.Plant,
            storageLocation: item.StorageLocation,
            requestedQuantity: item.RequestedQuantity ? parseFloat(item.RequestedQuantity) : null,
            requestedQuantityUnit: item.RequestedQuantityUnit,
            priceInDocumentCurrency: item.PriceInDocumentCurrency ? parseFloat(item.PriceInDocumentCurrency) : null,
            documentCurrency: item.DocumentCurrency,
            totalPrice:
              item.RequestedQuantity && item.PriceInDocumentCurrency
                ? parseFloat(item.RequestedQuantity) * parseFloat(item.PriceInDocumentCurrency)
                : null,
            deliveryDate: item.DeliveryDate ? new Date(item.DeliveryDate) : null,
            purchasingGroup: item.PurchasingGroup,
            purchasingOrganization: item.PurchasingOrganization,
            requisitioner: item.RequisitionerName,
            supplier: item.Supplier,
            itemProcessingStatus: item.PurchaseRequisitionStatus,
          })),
        });
      }
    });
  }
}
