# n8n Automation — SAP AI Triage Bridge

This workflow runs hourly: syncs SAP OData → triages new PRs → routes critical-risk items to Slack.

## Import

1. Open n8n → Workflows → **Import from file**
2. Select `n8n-workflow.json`
3. The workflow imports with all nodes connected

## Environment Variables (set in n8n Settings → Variables)

| Variable | Description | Example |
|----------|-------------|---------|
| `SAP_TRIAGE_API_URL` | Base URL of the deployed API | `https://your-app.vercel.app` |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | `https://hooks.slack.com/...` |

## Credentials

Create a credential named **"SAP Triage API Key"**:
- Type: **Header Auth**
- Name: `X-API-Key`
- Value: your `API_KEY` env var value

## Activate

1. Set env vars
2. Create the credential
3. Toggle the workflow **Active**
4. Click **Execute manually** to test
