# PLANNING.md — SAP AI Triage Bridge

> **Status:** Phase 1 — Approved for Scaffolding  
> **Author:** Senior Project Planner  
> **Date:** 2026-05-27  
> **Version:** 1.0

---

## ⚠️ Honesty Statement (Read First)

This repository is **NOT a SAP/ABAP system**. It is a modern AI automation layer that:

- **Consumes** the SAP S/4HANA OData V4 service exposed by a separate ABAP Cloud module
- **Does not run** any ABAP code, CDS Views, RAP Business Objects, or ABAP Unit tests
- **Simulates** the OData response shape via `SAP_SANDBOX_MODE` when a live BTP connection is not configured
- The actual SAP-native artifacts (RAP BO, CDS Views, OData V4 service) live in a separate ABAP Cloud module on SAP BTP

**The sandbox mock data is explicitly labeled in the UI and every API response.**  
No data flowing through this app in sandbox mode comes from a real SAP system.

---

## 1. Problem Statement

Enterprise procurement teams process hundreds of **Purchase Requisitions (PRs)** daily in SAP MM. Manual review is:

- **Slow** — reviewers read raw SAP data field-by-field
- **Error-prone** — price outliers and duplicate materials go unnoticed
- **Unscalable** — no structured risk scoring or spend categorization

**This project** demonstrates how a modern AI + automation layer, sitting *above* the SAP OData service, can:

1. Pull PR data from SAP in real-time (or from sandbox mock)
2. Run AI-powered triage: anomaly detection, spend categorization, risk scoring
3. Surface results in a clean dashboard
4. Route high-risk PRs automatically via n8n

**Portfolio goal:** Prove deep SAP MM domain knowledge (correct OData entity shape, MM field semantics, processing statuses) combined with modern engineering (TypeScript, Claude API, React, CI/CD).

---

## 2. Architecture Diagram

```mermaid
graph TD
    subgraph SAP_BTP ["SAP BTP (External — ABAP Cloud Module)"]
        RAP["RAP Business Object\n(Purchase Requisition)"]
        CDS["CDS View\nI_PurchaseRequisition"]
        ODATA["OData V4 Service\n/sap/opu/odata4/sap/api_purchasereq"]
        RAP --> CDS --> ODATA
    end

    subgraph THIS_REPO ["sap-ai-triage-bridge (THIS REPO)"]
        direction TB
        CLIENT["SapODataClient\n(live | sandbox)"]
        TRIAGE["AI Triage Service\n(Claude / OpenAI provider abstraction)"]
        API["Express REST API\n/api/v1/*"]
        DB[("PostgreSQL\nPrisma ORM")]
        WEB["React + Vite + Tailwind\nDashboard"]

        CLIENT -->|"parsed PRs"| TRIAGE
        TRIAGE -->|"TriageResult"| DB
        CLIENT -->|"raw PRs"| DB
        API -->|"CRUD + triage"| DB
        WEB -->|"REST calls"| API
    end

    subgraph AUTOMATION ["Automation Layer"]
        N8N["n8n Workflow\n(polls + routes)"]
        NOTIF["Slack / Email\n(high-risk alert)"]
        N8N -->|"POST /api/v1/triage/run"| API
        N8N -->|"high-risk items"| NOTIF
    end

    subgraph CI_CD ["CI/CD"]
        GHA["GitHub Actions\n(lint + test on PR)"]
        VERCEL["Vercel\n(frontend + serverless API)"]
        GHA --> VERCEL
    end

    ODATA -->|"OAuth2 / live mode"| CLIENT
    SAP_SANDBOX["Sandbox Mock\n(same OData schema)":::sandbox] -->|"sandbox mode"| CLIENT

    classDef sandbox fill:#f9c74f,stroke:#f3722c,color:#000
    classDef external fill:#90e0ef,stroke:#0077b6,color:#000
    class SAP_BTP external
```

---

## 3. What's Real vs. Simulated

| Aspect | Real (Live Mode) | Simulated (Sandbox Mode) |
|--------|-----------------|--------------------------|
| SAP connection | OAuth2 to SAP BTP ABAP Environment | None — all local |
| OData endpoint | `/sap/opu/odata4/sap/api_purchasereq_process/srvd_a2x/sap/purchaserequisition/0001/` | In-memory mock in `SapSandboxClient` |
| Data shape | Exactly as SAP returns it | Mirrors real OData V4 entity shape |
| AI triage | Real Claude API calls | Real Claude API calls (same code path) |
| Postgres storage | Real data from SAP | Realistic mock data stored identically |
| UI indicator | Green "LIVE — SAP BTP" badge | Yellow "SANDBOX MODE" banner |

**Honest divergences from real SAP behavior:**
- Real SAP uses `$expand`, `$filter`, `$select` OData query options; sandbox ignores query params and returns full mock set
- Real SAP PR status transitions follow workflow (BANF → release strategy); sandbox statuses are static
- Real SAP uses CSRF tokens for write operations; sandbox mode skips this
- Currency conversion and plant-specific pricing rules are not modeled

---

## 4. Data Model

### 4.1 SAP MM Purchase Requisition — OData V4 Entity Shape

Mirroring `A_PurchaseRequisitionHeader` and `A_PurchaseRequisitionItem` from SAP API_PURCHASEREQ_PROCESS_SRV.

#### `purchase_requisitions` (PR Header)

| Field | Type | SAP Field | Notes |
|-------|------|-----------|-------|
| id | UUID PK | — | Internal |
| purchase_requisition | VARCHAR(10) | PurchaseRequisition | SAP BANFN — "0010001234" |
| purchase_requisition_type | VARCHAR(4) | PurchaseRequisitionType | NB=standard, UB=stock transfer |
| description | VARCHAR(40) | PurReqnDescription | Header text |
| company_code | VARCHAR(4) | CompanyCode | e.g. "1000" |
| created_by_user | VARCHAR(12) | CreatedByUser | SAP username |
| creation_date | DATE | CreationDate | Edm.Date |
| last_change_date_time | TIMESTAMPTZ | LastChangeDateTime | Edm.DateTimeOffset |
| source_of_supply | VARCHAR(1) | SourceDetermination | bool-like |
| processing_status | VARCHAR(2) | ProcessingStatus | "01"=In process, "02"=Rel. done |
| raw_sap_payload | JSONB | — | Full OData response stored for audit |
| sandbox_mode | BOOLEAN | — | True if from mock |
| synced_at | TIMESTAMPTZ | — | When we pulled from SAP |
| created_at | TIMESTAMPTZ | — | Row creation |
| updated_at | TIMESTAMPTZ | — | Row update |

#### `purchase_requisition_items` (PR Item)

| Field | Type | SAP Field | Notes |
|-------|------|-----------|-------|
| id | UUID PK | — | Internal |
| requisition_id | UUID FK | — | → purchase_requisitions.id |
| purchase_requisition | VARCHAR(10) | PurchaseRequisition | Redundant for query perf |
| purchase_requisition_item | VARCHAR(5) | PurchaseRequisitionItem | "00010", "00020" |
| purchase_req_item_category | VARCHAR(1) | PurchReqnItemCategory | "0"=std, "9"=service |
| account_assignment_category | VARCHAR(1) | AccountAssignmentCategory | "K"=cost center, "P"=project |
| short_text | VARCHAR(40) | PurchasingDocumentItemText | Item description |
| material | VARCHAR(40) | Material | SAP MATNR |
| material_group | VARCHAR(9) | MaterialGroup | e.g. "001" |
| plant | VARCHAR(4) | Plant | e.g. "1000" |
| storage_location | VARCHAR(4) | StorageLocation | |
| requested_quantity | DECIMAL(13,3) | RequestedQuantity | |
| requested_quantity_unit | VARCHAR(3) | RequestedQuantityUnit | UoM: "KG", "EA", "L" |
| price_in_doc_currency | DECIMAL(13,2) | PriceInDocumentCurrency | Unit price |
| document_currency | VARCHAR(5) | DocumentCurrency | ISO 4217: "USD", "EUR" |
| total_price | DECIMAL(15,2) | — | Computed: qty × price |
| delivery_date | DATE | DeliveryDate | |
| purchasing_group | VARCHAR(3) | PurchasingGroup | |
| purchasing_org | VARCHAR(4) | PurchasingOrganization | |
| requisitioner | VARCHAR(12) | RequisitionerName | |
| supplier | VARCHAR(10) | Supplier | SAP vendor number |
| item_processing_status | VARCHAR(2) | PurchaseRequisitionStatus | Per-item status |
| created_at | TIMESTAMPTZ | — | |

#### `triage_results` (AI Analysis)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| requisition_id | UUID FK | → purchase_requisitions.id UNIQUE |
| risk_score | INTEGER | 0–100 (0=safe, 100=critical) |
| risk_level | VARCHAR(10) | "low" / "medium" / "high" / "critical" |
| spend_category | VARCHAR(50) | "IT Hardware", "Raw Materials", "Services", etc. |
| budget_type | VARCHAR(10) | "CAPEX" / "OPEX" |
| anomalies | JSONB | Array of detected anomalies |
| ai_summary | TEXT | Plain-language paragraph from Claude |
| recommendations | JSONB | Array of recommended actions |
| ai_provider | VARCHAR(20) | "claude" / "openai" |
| ai_model | VARCHAR(50) | "claude-sonnet-4-6" etc. |
| prompt_tokens | INTEGER | For cost tracking |
| completion_tokens | INTEGER | |
| processing_time_ms | INTEGER | Latency |
| triaged_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `sync_logs` (OData Sync History)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| mode | VARCHAR(10) | "live" / "sandbox" |
| status | VARCHAR(10) | "success" / "error" |
| records_fetched | INTEGER | |
| records_upserted | INTEGER | |
| error_message | TEXT | nullable |
| duration_ms | INTEGER | |
| synced_at | TIMESTAMPTZ | |

### 4.2 Indexes

```sql
-- Hot query: list by status + creation date
CREATE INDEX idx_pr_status_created ON purchase_requisitions(processing_status, creation_date DESC);

-- Hot query: items by requisition
CREATE INDEX idx_pri_requisition_id ON purchase_requisition_items(requisition_id);

-- Hot query: triage by risk level for dashboard
CREATE INDEX idx_triage_risk_level ON triage_results(risk_level, triaged_at DESC);

-- Hot query: triage by requisition (1:1 lookup)
CREATE UNIQUE INDEX idx_triage_requisition ON triage_results(requisition_id);

-- Search by material
CREATE INDEX idx_pri_material ON purchase_requisition_items(material);
```

---

## 5. API Contract

Base URL: `/api/v1`  
Content-Type: `application/json`  
Auth: API key via `X-API-Key` header (simple key auth for portfolio — document upgrade path to OAuth2 JWT)

### 5.1 Endpoints

```
# Requisitions
GET    /api/v1/requisitions                     → list + filter (status, risk, dateRange, plant, materialGroup)
GET    /api/v1/requisitions/:id                 → detail (header + items + triage result)
GET    /api/v1/requisitions/:id/items           → items only

# Triage
POST   /api/v1/triage/run/:requisitionId        → run AI triage for one PR
POST   /api/v1/triage/run-batch                 → bulk triage body: { requisitionIds: string[] }
GET    /api/v1/triage/:requisitionId            → get triage result
DELETE /api/v1/triage/:requisitionId            → re-trigger clean (admin)

# SAP Sync
POST   /api/v1/sync/trigger                     → pull from OData (live or sandbox)
GET    /api/v1/sync/logs                        → sync history

# Webhook (for n8n)
POST   /api/v1/webhook/triage-complete          → n8n calls this after triage run

# Health
GET    /api/v1/health                           → { status, mode, dbConnected, aiProvider }
GET    /api/v1/health/sap                       → test OData connectivity
```

### 5.2 Response Shape — Requisition List

```json
{
  "data": [
    {
      "id": "uuid",
      "purchaseRequisition": "0010001234",
      "description": "Office Supplies Q2",
      "processingStatus": "01",
      "processingStatusLabel": "In Process",
      "companyCode": "1000",
      "creationDate": "2026-05-01",
      "itemCount": 3,
      "totalValue": 12500.00,
      "currency": "USD",
      "sandboxMode": true,
      "triage": {
        "riskScore": 72,
        "riskLevel": "high",
        "spendCategory": "IT Hardware",
        "budgetType": "CAPEX",
        "triageAt": "2026-05-27T10:00:00Z"
      }
    }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "pageSize": 20,
    "sandboxMode": true
  }
}
```

### 5.3 Response Shape — Triage Result

```json
{
  "data": {
    "id": "uuid",
    "requisitionId": "uuid",
    "riskScore": 72,
    "riskLevel": "high",
    "spendCategory": "IT Hardware",
    "budgetType": "CAPEX",
    "anomalies": [
      {
        "type": "PRICE_OUTLIER",
        "field": "PriceInDocumentCurrency",
        "description": "Item 00010 price ($8,500) is 3.2x the average for MaterialGroup 'EDP'",
        "severity": "high"
      }
    ],
    "aiSummary": "This requisition for 5 laptop units from Plant 1000 shows a significant price anomaly on item 00010. The unit price of $8,500 is substantially above the typical range for this material group. Recommend vendor quote verification before release. Delivery date of 2026-06-15 is achievable but tight.",
    "recommendations": [
      "Request 3 competing vendor quotes for item 00010",
      "Verify budget availability in cost center before releasing",
      "Escalate to procurement manager — exceeds $10,000 threshold"
    ],
    "aiProvider": "claude",
    "aiModel": "claude-sonnet-4-6",
    "processingTimeMs": 1240,
    "triagedAt": "2026-05-27T10:00:00Z"
  }
}
```

### 5.4 Error Response Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date range: startDate must be before endDate",
    "field": "startDate",
    "requestId": "req_xyz123"
  }
}
```

---

## 6. Monorepo Structure

**Decision: Turborepo monorepo**  
Justification: Same pattern as Next.js ecosystem, clean workspace management, shared types package avoids DTO drift between front and back.

```
sap-ai-triage-bridge/
├── apps/
│   ├── api/                          ← Express + TypeScript backend
│   │   ├── src/
│   │   │   ├── domains/
│   │   │   │   ├── requisitions/     ← aggregate root
│   │   │   │   │   ├── RequisitionRepository.ts
│   │   │   │   │   ├── RequisitionService.ts
│   │   │   │   │   └── requisition.routes.ts
│   │   │   │   └── triage/           ← AI triage domain
│   │   │   │       ├── TriageService.ts
│   │   │   │       ├── triage.routes.ts
│   │   │   │       └── providers/
│   │   │   │           ├── AIProvider.interface.ts
│   │   │   │           ├── ClaudeProvider.ts
│   │   │   │           └── OpenAIProvider.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── sap/
│   │   │   │   │   ├── SapODataClient.interface.ts
│   │   │   │   │   ├── SapLiveClient.ts
│   │   │   │   │   └── SapSandboxClient.ts
│   │   │   │   ├── database/
│   │   │   │   │   └── prisma.client.ts
│   │   │   │   └── http/
│   │   │   │       ├── middleware/
│   │   │   │       │   ├── auth.middleware.ts
│   │   │   │       │   ├── error.middleware.ts
│   │   │   │       │   └── rateLimit.middleware.ts
│   │   │   │       └── validation/
│   │   │   │           └── zod.schemas.ts
│   │   │   ├── sync/
│   │   │   │   └── SyncService.ts
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   ├── .env.example
│   │   └── package.json
│   └── web/                          ← React + Vite + Tailwind frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/               ← design system primitives
│       │   │   ├── RequisitionTable/
│       │   │   ├── TriageCard/
│       │   │   ├── RiskBadge/
│       │   │   └── SandboxBanner/
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   └── RequisitionDetail.tsx
│       │   ├── hooks/
│       │   │   ├── useRequisitions.ts
│       │   │   └── useTriage.ts
│       │   ├── services/
│       │   │   └── api.client.ts
│       │   └── types/                ← re-exports from @sap-triage/shared
│       └── package.json
├── packages/
│   └── shared/                       ← shared TypeScript types + Zod schemas
│       ├── src/
│       │   ├── types/
│       │   │   ├── sap.types.ts      ← OData entity types
│       │   │   ├── triage.types.ts
│       │   │   └── api.types.ts
│       │   └── schemas/
│       │       └── requisition.schema.ts
│       └── package.json
├── automation/
│   ├── n8n-workflow.json             ← n8n export
│   └── README.md                     ← setup docs
├── .github/
│   └── workflows/
│       ├── ci.yml                    ← lint + test on PR
│       └── deploy-preview.yml
├── PLANNING.md                       ← this file
├── README.md
├── DEPLOY.md
├── turbo.json
├── package.json                      ← workspace root
└── .env.example
```

---

## 7. SAP Skills Demonstrated

This project models the following SAP concepts (the real artifacts live in the companion ABAP Cloud module):

| Concept | What's Modeled Here | Where Real ABAP Lives |
|---------|--------------------|-----------------------|
| RAP Business Object | PR entity shape, status semantics | ABAP Cloud module (separate repo) |
| CDS View (I_PurchaseRequisition) | Field names, types, associations | ABAP Cloud module |
| OData V4 Service | Request/response shape, entity sets | ABAP Cloud module |
| MM Purchase Requisition | Full field set: BANFN, BNART, MATNR, WERKS, MENGE, PREIS | Modeled in shared/types/sap.types.ts |
| Processing Status codes | "01"–"N5" status lifecycle | Coded in SAP MM documentation |
| Account Assignment Category | K (cost center), P (project), F (order) | In data model + sandbox mock |
| Material Group spend categorization | AI maps MATKL to spend categories | TriageService.ts |
| Clean Core principle | No ABAP modifications — consumes standard API | Architecture decision |

---

## 8. RFCs — Implementation Units

### RFC-001 — Monorepo Scaffold + DB Schema + Prisma Migrations
**Alcance:** Initialize Turborepo workspace, `shared` package with SAP types, `api` app with Prisma schema (all 4 tables), initial migration, `.env.example`.  
**Archivos:**
- `package.json` (root), `turbo.json`
- `packages/shared/src/types/sap.types.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/001_initial_schema.sql`
- `.env.example`  
**Dependencias:** Ninguna  
**Criterios:**
- [ ] `pnpm install` succeeds at root
- [ ] `pnpm db:migrate` applies schema cleanly
- [ ] TypeScript compiles with zero errors
- [ ] All SAP fields present in Prisma schema with correct types

---

### RFC-002 — SapODataClient (Sandbox + Live modes)
**Alcance:** Interface + two implementations. Sandbox returns 15 realistic mock PRs covering all field combinations (different statuses, plants, materials, currencies). Live client uses `node-fetch` with OAuth2 client credentials flow against SAP BTP.  
**Archivos:**
- `apps/api/src/infrastructure/sap/SapODataClient.interface.ts`
- `apps/api/src/infrastructure/sap/SapSandboxClient.ts`
- `apps/api/src/infrastructure/sap/SapLiveClient.ts`
- `apps/api/src/infrastructure/sap/sap.mock-data.ts`  
**Dependencias:** RFC-001  
**Criterios:**
- [ ] Sandbox returns data matching exact OData V4 field names
- [ ] Live client handles token expiry with auto-refresh
- [ ] Mode selected via `SAP_MODE=sandbox|live` env var
- [ ] Both modes return `SapPurchaseRequisition[]` — identical shape

---

### RFC-003 — AI Triage Service + Provider Abstraction
**Alcance:** `AIProvider` interface, `ClaudeProvider` (using Anthropic SDK with prompt caching), `OpenAIProvider` stub (swappable). `TriageService` orchestrates: fetch PR → build prompt → call AI → parse response → validate with Zod → return `TriageResult`.  
**Archivos:**
- `apps/api/src/domains/triage/providers/AIProvider.interface.ts`
- `apps/api/src/domains/triage/providers/ClaudeProvider.ts`
- `apps/api/src/domains/triage/providers/OpenAIProvider.ts`
- `apps/api/src/domains/triage/TriageService.ts`  
**Dependencias:** RFC-001  
**Criterios:**
- [ ] Switching `AI_PROVIDER=claude|openai` changes provider at runtime
- [ ] Claude prompt uses system prompt caching (Anthropic SDK `cache_control`)
- [ ] Output always conforms to `TriageResult` Zod schema
- [ ] Risk score is 0–100 integer, never null
- [ ] Anomaly detection covers: price outlier, quantity spike, missing delivery date, unknown material group

---

### RFC-004 — Express REST API + Validation + Error Handling
**Alcance:** All endpoints from §5.1. Zod input validation, centralized error middleware (never leaks `err.message`), rate limiting on public endpoints, request ID header, structured logging (pino).  
**Archivos:**
- `apps/api/src/domains/requisitions/requisition.routes.ts`
- `apps/api/src/domains/triage/triage.routes.ts`
- `apps/api/src/sync/SyncService.ts`
- `apps/api/src/infrastructure/http/middleware/`
- `apps/api/src/index.ts`  
**Dependencias:** RFC-002, RFC-003  
**Criterios:**
- [ ] All inputs validated with Zod before DB access
- [ ] Error responses always `{ error: { code, message } }` — no raw stack traces
- [ ] `GET /api/v1/health` returns DB + SAP connectivity status
- [ ] Rate limit: 100 req/min on triage endpoints

---

### RFC-005 — GitHub Actions CI
**Alcance:** `ci.yml` runs on every PR: install deps → lint → typecheck → unit tests → integration tests (against a Postgres service container).  
**Archivos:**
- `.github/workflows/ci.yml`  
**Dependencias:** RFC-004  
**Criterios:**
- [ ] CI passes on a fresh repo clone
- [ ] Uses `pnpm` with dependency cache
- [ ] Postgres service container spun up for integration tests
- [ ] CI fails on TypeScript errors and lint violations

---

### RFC-006 — React Dashboard (List View)
**Alcance:** Main dashboard page: paginated table of PRs with columns (PR number, description, status, total value, risk score badge, material group, plant, triaged date). Filters: status, risk level, date range, plant. Sandbox banner always visible when `SAP_SANDBOX_MODE=true`.  
**Archivos:**
- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/components/RequisitionTable/`
- `apps/web/src/components/RiskBadge/`
- `apps/web/src/components/SandboxBanner/`
- `apps/web/src/hooks/useRequisitions.ts`  
**Dependencias:** RFC-004  
**Criterios:**
- [ ] Sandbox banner is always yellow and prominent when in sandbox mode
- [ ] Risk badges: green (low), yellow (medium), orange (high), red (critical)
- [ ] Filters update URL query params (shareable links)
- [ ] Loading and empty states handled

---

### RFC-007 — PR Detail View + AI Summary
**Alcance:** Detail page for a single PR. Shows all header fields, line items table, and the AI triage panel: risk score donut chart, anomaly list, AI summary paragraph, recommendations. "Run Triage" button triggers triage and shows progress.  
**Archivos:**
- `apps/web/src/pages/RequisitionDetail.tsx`
- `apps/web/src/components/TriageCard/`
- `apps/web/src/hooks/useTriage.ts`  
**Dependencias:** RFC-006  
**Criterios:**
- [ ] AI summary renders as formatted text, not raw JSON
- [ ] "Run Triage" shows spinner while AI processes
- [ ] Anomalies list with severity color coding
- [ ] Back navigation preserves list filters

---

### RFC-008 — n8n Workflow + Webhook
**Alcance:** n8n workflow JSON that: (1) triggers on schedule or manual, (2) calls `POST /api/v1/sync/trigger`, (3) fetches untriaged PRs, (4) calls `POST /api/v1/triage/run/:id` for each, (5) routes `riskLevel === "critical"` to Slack/email notification node. Include setup docs.  
**Archivos:**
- `automation/n8n-workflow.json`
- `automation/README.md`
- `apps/api/src/domains/triage/triage.routes.ts` (webhook endpoint addition)  
**Dependencias:** RFC-004  
**Criterios:**
- [ ] Workflow JSON imports cleanly into n8n
- [ ] Webhook endpoint validates a shared secret in header
- [ ] Setup docs cover: import steps, env vars needed, Slack node config

---

### RFC-009 — Vercel Deploy + DEPLOY.md
**Alcance:** `vercel.json` routing API serverless functions, `DEPLOY.md` with step-by-step for Vercel + Neon/Supabase Postgres + required env vars. Vercel environment variable list.  
**Archivos:**
- `vercel.json`
- `DEPLOY.md`
- `.github/workflows/deploy-preview.yml`  
**Dependencias:** RFC-005  
**Criterios:**
- [ ] `vercel --prod` deploys with zero manual config beyond env vars
- [ ] DEPLOY.md covers cold-start from zero (no prior Vercel account assumed)
- [ ] All 15 required env vars documented with descriptions and example values

---

### RFC-010 — Tests (Unit + Integration + E2E)
**Alcance:** Unit: TriageService (mock AI provider), SapSandboxClient (data shape), risk scoring logic. Integration: API endpoints against test Postgres (using Vitest + supertest). E2E: happy path — sync → triage → view result (using Playwright against local dev server).  
**Archivos:**
- `apps/api/tests/unit/TriageService.test.ts`
- `apps/api/tests/unit/SapSandboxClient.test.ts`
- `apps/api/tests/integration/requisitions.api.test.ts`
- `apps/api/tests/integration/triage.api.test.ts`
- `apps/web/tests/e2e/dashboard.spec.ts`  
**Dependencias:** RFC-004, RFC-007  
**Criterios:**
- [ ] Unit tests: ≥85% branch coverage on triage domain
- [ ] Integration tests: all happy paths + main error paths (404, 422, 500)
- [ ] E2E: sync → wait for triage → verify risk badge renders on dashboard
- [ ] All tests run in CI (RFC-005)
- [ ] No mocking the database in integration tests — real test Postgres container

---

## 9. Environment Variables

```bash
# apps/api/.env.example

# ─── App ────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
API_KEY=your-api-key-here

# ─── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/sap_triage

# ─── SAP Integration ────────────────────────────────────────
SAP_MODE=sandbox                           # "sandbox" | "live"
SAP_BTP_BASE_URL=                          # https://your-btp-tenant.s4hana.cloud.sap
SAP_BTP_CLIENT_ID=                         # OAuth2 client ID
SAP_BTP_CLIENT_SECRET=                     # OAuth2 client secret
SAP_BTP_TOKEN_URL=                         # OAuth2 token endpoint

# ─── AI Provider ────────────────────────────────────────────
AI_PROVIDER=claude                         # "claude" | "openai"
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...                      # only if AI_PROVIDER=openai

# ─── n8n Webhook ────────────────────────────────────────────
N8N_WEBHOOK_SECRET=your-webhook-secret

# apps/web/.env.example
VITE_API_URL=http://localhost:3001
VITE_SAP_MODE=sandbox                      # mirrors backend mode for UI banner
```

---

## 10. Decision Log

| Decision | Chosen | Rejected | Reason |
|----------|--------|----------|--------|
| ORM | Prisma | Drizzle | Better DX for portfolio clarity, excellent TypeScript codegen, mature migration tooling |
| Monorepo tool | Turborepo | nx | Simpler config, native pnpm workspaces, enough for 2 apps |
| Package manager | pnpm | npm/yarn | Workspace support, faster, deterministic |
| Test runner | Vitest | Jest | Faster, native ESM, same config as Vite |
| Validation | Zod | Joi/yup | TypeScript-first, inference works across front and back via shared package |
| API auth | API Key | JWT | Portfolio simplicity — document upgrade path to OAuth2 |
| Logging | pino | winston | Faster, structured JSON, Vercel-compatible |

---

> ✅ **PLANNING.md completo.**  
> Próximo paso: `/po-senior` → Backlog priorizado + historias de usuario SMART  
> ¿Ajustes antes de continuar con el pipeline?
