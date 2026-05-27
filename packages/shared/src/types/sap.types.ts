/**
 * SAP S/4HANA OData V4 Purchase Requisition entity types.
 * Field names mirror the real SAP API_PURCHASEREQ_PROCESS_SRV OData service.
 * Source: SAP API Business Hub — A_PurchaseRequisitionHeader / A_PurchaseRequisitionItem
 *
 * NOTE: This app is NOT a SAP/ABAP system. It consumes the OData service.
 * When SAP_MODE=sandbox, data is mocked with this exact shape.
 */

export type PurchaseRequisitionType =
  | 'NB'  // Standard PR
  | 'UB'  // Stock transfer
  | 'FO'  // Framework order ref
  | string;

export type ProcessingStatus =
  | '01'  // In process
  | '02'  // Release completed
  | 'N1'  // Ordered (PO created)
  | 'N5'  // Closed
  | string;

export type AccountAssignmentCategory =
  | 'K'   // Cost center
  | 'P'   // Project (WBS)
  | 'F'   // Order
  | ' '   // Unknown / blank
  | string;

export type PurchReqnItemCategory =
  | '0'   // Standard
  | '9'   // Service
  | '2'   // Consignment
  | string;

/** Mirrors A_PurchaseRequisitionHeader OData V4 entity */
export interface SapPurchaseRequisitionHeader {
  PurchaseRequisition: string;            // BANFN — max 10 chars
  PurchaseRequisitionType: PurchaseRequisitionType;
  PurReqnDescription: string | null;      // Header text
  CompanyCode: string;                    // max 4 chars
  CreatedByUser: string;                  // SAP username, max 12 chars
  CreationDate: string;                   // Edm.Date — "2026-05-01"
  LastChangeDateTime: string;             // Edm.DateTimeOffset — ISO 8601
  SourceDetermination: boolean;
  ProcessingStatus: ProcessingStatus;
}

/** Mirrors A_PurchaseRequisitionItem OData V4 entity */
export interface SapPurchaseRequisitionItem {
  PurchaseRequisition: string;
  PurchaseRequisitionItem: string;        // "00010", "00020", etc.
  PurchReqnItemCategory: PurchReqnItemCategory;
  AccountAssignmentCategory: AccountAssignmentCategory;
  PurchasingDocumentItemText: string | null;  // Short text
  Material: string | null;                // MATNR — max 40 chars
  MaterialGroup: string | null;           // MATKL — max 9 chars
  Plant: string | null;                   // WERKS — max 4 chars
  StorageLocation: string | null;         // LGORT — max 4 chars
  RequestedQuantity: string | null;       // OData returns as string
  RequestedQuantityUnit: string | null;   // UoM: "KG", "EA", "L"
  PriceInDocumentCurrency: string | null; // Unit price, string in OData
  DocumentCurrency: string | null;        // ISO 4217: "USD", "EUR"
  DeliveryDate: string | null;            // Edm.Date
  PurchasingGroup: string | null;         // max 3 chars
  PurchasingOrganization: string | null;  // max 4 chars
  RequisitionerName: string | null;
  Supplier: string | null;               // SAP vendor number
  PurchaseRequisitionStatus: ProcessingStatus | null; // per-item status
}

/** Full PR with navigation to items (as returned by SAP OData $expand) */
export interface SapPurchaseRequisition extends SapPurchaseRequisitionHeader {
  to_PurchaseReqnItem: SapPurchaseRequisitionItem[];
}
