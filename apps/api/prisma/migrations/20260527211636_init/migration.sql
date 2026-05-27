-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" UUID NOT NULL,
    "purchaseRequisition" VARCHAR(10) NOT NULL,
    "purchaseRequisitionType" VARCHAR(4) NOT NULL,
    "description" VARCHAR(40),
    "companyCode" VARCHAR(4) NOT NULL,
    "createdByUser" VARCHAR(12) NOT NULL,
    "creationDate" DATE NOT NULL,
    "lastChangeDateTime" TIMESTAMPTZ NOT NULL,
    "processingStatus" VARCHAR(2) NOT NULL,
    "rawSapPayload" JSONB NOT NULL,
    "sandboxMode" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_items" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "purchaseRequisition" VARCHAR(10) NOT NULL,
    "purchaseRequisitionItem" VARCHAR(5) NOT NULL,
    "purchReqnItemCategory" VARCHAR(1),
    "accountAssignmentCategory" VARCHAR(1),
    "shortText" VARCHAR(40),
    "material" VARCHAR(40),
    "materialGroup" VARCHAR(9),
    "plant" VARCHAR(4),
    "storageLocation" VARCHAR(4),
    "requestedQuantity" DECIMAL(13,3),
    "requestedQuantityUnit" VARCHAR(3),
    "priceInDocumentCurrency" DECIMAL(13,2),
    "documentCurrency" VARCHAR(5),
    "totalPrice" DECIMAL(15,2),
    "deliveryDate" DATE,
    "purchasingGroup" VARCHAR(3),
    "purchasingOrganization" VARCHAR(4),
    "requisitioner" VARCHAR(12),
    "supplier" VARCHAR(10),
    "itemProcessingStatus" VARCHAR(2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triage_results" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" VARCHAR(10) NOT NULL,
    "spendCategory" VARCHAR(50) NOT NULL,
    "budgetType" VARCHAR(10) NOT NULL,
    "anomalies" JSONB NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "aiProvider" VARCHAR(20) NOT NULL,
    "aiModel" VARCHAR(50) NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "processingTimeMs" INTEGER,
    "triagedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "triage_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_purchaseRequisition_key" ON "purchase_requisitions"("purchaseRequisition");

-- CreateIndex
CREATE INDEX "purchase_requisitions_processingStatus_creationDate_idx" ON "purchase_requisitions"("processingStatus", "creationDate" DESC);

-- CreateIndex
CREATE INDEX "purchase_requisition_items_requisitionId_idx" ON "purchase_requisition_items"("requisitionId");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_material_idx" ON "purchase_requisition_items"("material");

-- CreateIndex
CREATE UNIQUE INDEX "triage_results_requisitionId_key" ON "triage_results"("requisitionId");

-- CreateIndex
CREATE INDEX "triage_results_riskLevel_triagedAt_idx" ON "triage_results"("riskLevel", "triagedAt" DESC);

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_results" ADD CONSTRAINT "triage_results_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
