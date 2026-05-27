# Deploy Guide — SAP AI Triage Bridge

## Prerequisites

- Vercel account (free tier works)
- Neon account (free tier: 0.5 GB, enough for portfolio)
- GitHub repo with the code pushed
- Anthropic API key

---

## Step 1 — Provision Postgres on Neon

1. Go to [neon.tech](https://neon.tech) → **New Project**
2. Name: `sap-triage-bridge`, Region: closest to you
3. Copy the **Connection String** (it looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
4. Save as `DATABASE_URL`

---

## Step 2 — Push Code to GitHub

```bash
git init
git remote add origin https://github.com/cdgutierrez6/sap-ai-triage-bridge.git
git add .
git commit -m "feat: initial SAP AI Triage Bridge"
git push -u origin main
```

---

## Step 3 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# From project root
vercel

# Follow prompts:
#   Link to existing project? No
#   Project name: sap-ai-triage-bridge
#   Which directory? . (root)
#   Override build settings? No
```

---

## Step 4 — Configure Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → **Settings → Environment Variables**. Add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | |
| `API_KEY` | `<generate 32+ char random string>` | `openssl rand -hex 32` |
| `DATABASE_URL` | `<neon connection string>` | From Step 1 |
| `SAP_MODE` | `sandbox` | Change to `live` when BTP is configured |
| `AI_PROVIDER` | `claude` | |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From console.anthropic.com |
| `N8N_WEBHOOK_SECRET` | `<random 32 chars>` | Optional |
| `VITE_API_URL` | `https://your-app.vercel.app` | Frontend env var |
| `VITE_SAP_MODE` | `sandbox` | Controls sandbox banner in UI |
| `VITE_API_KEY` | Same as `API_KEY` above | Frontend API key |

For SAP live mode (optional), also add:

| Variable | Description |
|----------|-------------|
| `SAP_BTP_BASE_URL` | Your BTP tenant base URL |
| `SAP_BTP_CLIENT_ID` | OAuth2 client ID from BTP cockpit |
| `SAP_BTP_CLIENT_SECRET` | OAuth2 client secret |
| `SAP_BTP_TOKEN_URL` | Token endpoint URL |

---

## Step 5 — Run DB Migration on Neon

```bash
# Set DATABASE_URL locally to the Neon connection string
export DATABASE_URL="<neon-connection-string>"

# Deploy migrations
pnpm db:migrate:prod
```

---

## Step 6 — Verify Deployment

```bash
# Health check
curl https://your-app.vercel.app/api/v1/health

# Expected response:
# { "status": "ok", "dbConnected": true, "sapMode": "sandbox", ... }
```

Open `https://your-app.vercel.app` — you should see the dashboard with ⚠️ SANDBOX MODE banner.

---

## Step 7 — Run Initial Sync

```bash
curl -X POST https://your-app.vercel.app/api/v1/sync/trigger \
  -H "X-API-Key: <your-api-key>"
```

This loads the 10 sandbox mock PRs into Postgres. Refresh the dashboard to see them.

---

## GitHub Actions — Required Secrets

In your GitHub repo → **Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (for integration tests) |

---

## Troubleshooting

**Cold start > 3s**: Expected on Vercel serverless free tier. The first request after inactivity spins up the container. Subsequent requests are fast.

**DB connection refused**: Neon free tier suspends after 5 min of inactivity. Add `?connect_timeout=10&pool_timeout=10` to the connection string.

**Prisma client not found**: Run `pnpm db:generate` before deploying.
