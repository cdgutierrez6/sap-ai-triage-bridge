# SAP AI Triage Bridge — CLAUDE.md

## Descripción del Proyecto
AI layer que ingiere datos de SAP S/4HANA (módulo MM, purchase requisitions via OData V4) y ejecuta triage inteligente: detección de anomalías, categorización de spend, scoring de riesgo y resúmenes en lenguaje natural. Usa Claude API (Anthropic) + OpenAI.

## Arquitectura — Turborepo Monorepo
```
sap-ai-triage-bridge/
├── apps/
│   ├── api/          # Express.js — OData sync, triage engine, REST API
│   └── web/          # React + Vite — Dashboard de triage
├── packages/
│   └── shared/       # Types, DTOs, utils compartidos
├── turbo.json
└── pnpm-workspace.yaml
```

## Stack
| Capa | Tecnología |
|------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| API | Express.js + TypeScript + Pino (logs) |
| AI | Anthropic Claude SDK + OpenAI SDK |
| ORM | Prisma + PostgreSQL |
| Validación | Zod |
| Rate limiting | express-rate-limit |
| Frontend | React 18 + Vite + TypeScript |
| Shared | `@sap-triage/shared` (workspace package) |

## Estructura API (`apps/api/src/`)
```
config/         # Variables de entorno, configuración global
domains/        # Lógica de negocio (triage, anomalías, scoring)
infrastructure/ # Prisma client, external clients (SAP OData, AI SDKs)
sync/           # Sincronización de datos SAP → DB
index.ts        # Entry point Express
```

## Estructura Web (`apps/web/src/`)
```
components/     # UI components reutilizables
hooks/          # React hooks (data fetching, state)
pages/          # Vistas del dashboard
services/       # API clients
types/          # TypeScript types
utils/          # Helpers
```

## Comandos
```bash
# Dev (todos los apps en paralelo)
pnpm dev

# Build
pnpm build

# Solo API
pnpm --filter api dev

# Solo Web
pnpm --filter web dev

# Tests
pnpm test
```

## Variables de Entorno (apps/api/.env)
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
SAP_BASE_URL=https://...
SAP_USERNAME=...
SAP_PASSWORD=...
PORT=3001
```

## Convenciones
- TypeScript estricto en todos los packages
- Schemas Zod para validación de OData payloads y AI responses
- Pino para logging estructurado (JSON)
- `@sap-triage/shared` — importar tipos desde el workspace, nunca duplicarlos
- Prisma migrations en `apps/api/prisma/migrations/`

## GitHub
Repo: `cdgutierrez6/sap-ai-triage-bridge`
Branch default: `main`

## Estado actual
En desarrollo — pipeline de sync SAP → triage AI → dashboard funcional.

## Reglas de trabajo
1. Antes de tocar OData sync → pipeline 🟠 DB si hay cambios de schema
2. Cambios en AI prompts → documentar en `domains/` con el prompt y su versión
3. Tipos compartidos → siempre en `packages/shared`, nunca en un solo app
