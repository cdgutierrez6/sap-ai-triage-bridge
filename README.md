# SAP AI Triage Bridge

![CI](https://github.com/cdgutierrez6/sap-ai-triage-bridge/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Node](https://img.shields.io/badge/Node.js-20_LTS-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> **Portfolio project** — An AI-powered automation layer that ingests SAP S/4HANA purchase-requisition data (MM module) and runs intelligent triage: anomaly detection, spend categorization, risk scoring, and plain-language summaries.

---

## ⚠️ Honesty Statement

**This repository is NOT a SAP/ABAP system.** It is a modern AI + Node.js automation layer that:

- **Consumes** the SAP S/4HANA OData V4 service exposed by a separate ABAP Cloud module
- **Does not run** ABAP code, CDS Views, RAP Business Objects, or ABAP Unit tests
- **Simulates** the OData response shape via `SAP_MODE=sandbox` (clearly labeled in the UI and every API response)

The actual SAP-native artifacts (RAP BO, CDS Views, OData V4 service) live in a separate ABAP Cloud module on SAP BTP.

---

## Architecture

```
[SAP BTP ABAP Cloud]  ←──────── separate ABAP module ────────────────────────────
  RAP Business Object                                                              
  CDS View (I_PurchaseRequisition)                                                
  OData V4 Service                                                                
         │                                                                        
         │ OAuth2 / live mode                                                     
         ▼                                                                        
[SapODataClient]  ←── SAP_MODE=sandbox → [SapSandboxClient (mock, same schema)]  
         │                                                                        
         ▼                                                                        
[Express REST API] ──► [TriageService] ──► [Claude AI / OpenAI]                  
         │                    │                                                   
         │                    ▼                                                   
         │            [PostgreSQL / Prisma]                                       
         │                    ▲                                                   
         ▼                    │                                                   
[React Dashboard] ────────────┘                                                   
                                                                                  
[n8n Workflow] ──► polls sync ──► runs triage ──► routes critical → Slack        
```

---

## SAP Skills Demonstrated

This project models the following SAP concepts accurately (the real ABAP artifacts live in the companion module):

| Concept | Where in this repo | Real ABAP location |
|---------|-------------------|-------------------|
| **RAP Business Object** | Entity shape in `packages/shared/src/types/sap.types.ts` | ABAP Cloud module |
| **CDS View** (`I_PurchaseRequisition`) | Field names, types, associations mirrored exactly | ABAP Cloud module |
| **OData V4 Service** | Request/response shape, `to_PurchaseReqnItem` navigation | ABAP Cloud module |
| **MM Purchase Requisition** | BANFN, BSART, MATNR, WERKS, MENGE, PREIS, BSART | `sap.mock-data.ts` |
| **Processing Status codes** | 01=In Process, 02=Released, N1=Ordered, N5=Closed | `sap.utils.ts` |
| **Account Assignment Category** | K=Cost Center, P=Project/WBS, F=Order | data model |
| **Material Group spend categorization** | AI maps MATKL → spend categories | `ClaudeProvider.ts` |
| **Clean Core principle** | Consumes standard SAP API, no modifications | Architecture decision |
| **OAuth2 Client Credentials** | `SapLiveClient.ts` token management | `SapLiveClient.ts` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 + TypeScript + Express 5 |
| Database | PostgreSQL + Prisma 5 |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| AI | Anthropic Claude API (provider abstraction → OpenAI swappable) |
| Automation | n8n workflow (JSON export in `/automation`) |
| Monorepo | Turborepo + pnpm workspaces |
| Deploy | Vercel (frontend + serverless API) |
| CI | GitHub Actions |

---

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 9+, PostgreSQL 15+

git clone https://github.com/cdgutierrez6/sap-ai-triage-bridge.git
cd sap-ai-triage-bridge

# Install all workspace dependencies
pnpm install

# Configure environment
cp .env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL and ANTHROPIC_API_KEY at minimum

# Run DB migrations
pnpm db:migrate

# Start dev servers (API on :3001, Web on :5173)
pnpm dev
```

Open `http://localhost:5173` — you'll see the dashboard with the ⚠️ **SANDBOX MODE** banner.

---

## Environment Variables

See [`.env.example`](.env.example) for all variables with descriptions.

**Minimum for sandbox mode:**

```env
API_KEY=your-api-key-min-32-chars
DATABASE_URL=postgresql://user:pass@localhost:5432/sap_triage
ANTHROPIC_API_KEY=sk-ant-...
SAP_MODE=sandbox
AI_PROVIDER=claude
```

---

## Project Structure

```
sap-ai-triage-bridge/
├── apps/
│   ├── api/        ← Express backend (Clean Architecture)
│   └── web/        ← React + Vite + Tailwind dashboard
├── packages/
│   └── shared/     ← Shared TypeScript types + Zod schemas
├── automation/     ← n8n workflow export
├── .github/        ← GitHub Actions CI
├── PLANNING.md     ← Architecture decisions, data model, API contract
└── DEPLOY.md       ← Step-by-step deployment guide
```

---

## AI Triage Logic

For each Purchase Requisition, Claude analyzes:

1. **Price outliers** — compares unit prices against material group averages
2. **Quantity spikes** — flags unusual order quantities
3. **Missing delivery dates** — procurement risk indicator
4. **Rush deliveries** — < 7 days from today
5. **Missing supplier** — especially for high-value items
6. **Account assignment** — K/P/F vs. blank (stock)

Output: `riskScore` (0–100), `riskLevel` (low/medium/high/critical), `spendCategory`, `budgetType` (CAPEX/OPEX), anomaly list, plain-language summary, and action recommendations.

---

## API Reference

```
GET  /api/v1/health                      → system health check
GET  /api/v1/requisitions                → list with filters (status, riskLevel, plant, date, search)
GET  /api/v1/requisitions/:id            → PR detail with items + triage result
POST /api/v1/triage/run/:requisitionId   → run AI triage for one PR
POST /api/v1/triage/run-batch            → bulk triage (up to 50 PRs)
GET  /api/v1/triage/:requisitionId       → get existing triage result
POST /api/v1/sync/trigger                → pull from OData (live or sandbox)
GET  /api/v1/sync/logs                   → sync history
```

All endpoints require `X-API-Key` header. Rate limit: 100 req/min on triage endpoints.

---

## Running Tests

```bash
pnpm test              # all tests
pnpm test:coverage     # with coverage report
```

Tests include: unit (TriageService, SapSandboxClient), integration (API endpoints against real Postgres), and E2E (Playwright dashboard flow).

---

## Deploy

See [`DEPLOY.md`](DEPLOY.md) for full step-by-step instructions (Vercel + Neon Postgres).

---

## License

MIT © Cristian Gutierrez
