# n8n Integration

## Overview

n8n is a workflow automation tool. Kivo Geo integrates with it **lightly** — via webhooks.

## Architecture

```
Kivo Geo Backend
  │
  ├── Outbound: POST to n8n webhook URL (optional)
  │     → Triggers n8n workflows
  │     → e.g., daily content generation, Slack notifications
  │
  └── Inbound: POST /api/n8n/log
        ← n8n workflows log events back
        → Stored in activity_logs as entity_type='pipeline'
```

## Configuration

Set in `.env`:

```
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/...
```

If empty/not set, the integration is disabled.

## Inbound Logging Endpoint

`POST /api/n8n/log` (requires auth — JWT or API key)

Payload:
```json
{
  "event": "pipeline_completed",
  "message": "Daily content generation finished",
  "level": "info",
  "metadata": { "articles_generated": 5 }
}
```

- `event` — required, short identifier
- `message` — required, human-readable
- `level` — optional, default "info" (info/warn/error/debug)
- `metadata` — optional JSON

Stored in `activity_logs` table with `entity_type = 'pipeline'`.

## What n8n Can Do

Common n8n workflows triggered by the system or scheduled externally:

- **Daily content generation** — triggers keyword research or article generation
- **Slack notifications** — sends alerts on pipeline completion or failure
- **Report generation** — compiles weekly analytics
- **Error handling** — captures dead-letter queue events

## Current Status

The integration is **minimal** — only the logging endpoint and config are implemented. There is no direct n8n npm SDK or workflow management in the backend.

n8n itself runs as a separate service (not on this EC2). It was seen in the project as an n8n Docker setup (`docker-compose.yml` no longer has it) and data/logs at `/root/n8n/`.
