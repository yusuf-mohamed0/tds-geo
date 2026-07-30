#!/bin/bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
# Script to update the n8n workflow with all fixes
# Uses the credentials and client IDs obtained from fix-n8n-workflow.sh

CLIENT_ID="${N8N_CLIENT_ID:-38e6e8da-b1c7-436c-809d-03bb46b42a1d}"
CRED_ID="${N8N_CRED_ID:-wUyDyyJNGFlrdFIH}"
N8N_USER_ID="${N8N_USER_ID:-08a7ba98-26a5-4c27-9aef-e78ae2c589ce}"
N8N_ADMIN_EMAIL="${N8N_ADMIN_EMAIL:-admin@tds-geo.internal}"
N8N_ADMIN_PASSWORD="${N8N_ADMIN_PASSWORD:-TDSg30!Pr0d#2026_X9}"

# Build the fixed workflow JSON and update via API
curl -s -b /tmp/n8n-cookies.txt -X PUT "http://localhost:5678/rest/workflows/fe6d6e24-8afa-4d72-a127-4aeec5a687bc" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${N8N_USER_ID}" \
  -d '{
  "name": "AI SEO Shopify Agent",
  "active": true,
  "nodes": [
    {
      "id": "cron-trigger",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [-48, 96],
      "parameters": {
        "rule": {"interval": [{}]},
        "scheduleType": "interval",
        "scheduleInterval": {"item": [{"name": "Days", "value": 1}]}
      }
    },
    {
      "id": "set-client-id",
      "name": "Set Client ID",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [192, 80],
      "parameters": {
        "values": {"string": [{"name": "clientId", "value": "'"$CLIENT_ID"'"}]},
        "options": {}
      }
    },
    {
      "id": "login",
      "name": "Login to Vireon",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [416, 32],
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/api/auth/login",
        "authentication": "none",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [{"name": "email", "value": "'"$N8N_ADMIN_EMAIL"'"}, {"name": "password", "value": "'"$N8N_ADMIN_PASSWORD"'"}]
        },
        "options": {"timeout": 15000}
      }
    },
    {
      "id": "http-keywords",
      "name": "Discover Keywords",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [608, 64],
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/api/clients/{{ \$('Set Client ID').item.json.clientId }}/keywords/discover",
        "authentication": "none",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {"name": "industry", "value": "maintenance"},
            {"name": "seedKeywords", "value": "[\"home maintenance\", \"property care\", \"preventative maintenance\", \"home repair tips\"]"},
            {"name": "count", "value": 20}
          ]
        },
        "options": {
          "timeout": 30000,
          "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer {{ \$('Login to Vireon').item.json.token }}"}]}
        }
      }
    },
    {
      "id": "message-model",
      "name": "Message a model",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 2.3,
      "position": [1008, 32],
      "parameters": {
        "modelId": {"__rl": true, "mode": "list", "value": "gpt-4o"},
        "options": {}
      },
      "credentials": {
        "openAiApi": {"id": "'$CRED_ID'", "name": "OpenAI API"}
      }
    },
    {
      "id": "wait-30s",
      "name": "Wait 30s",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.2,
      "position": [750, 400],
      "parameters": {"resume": "timeInterval", "amount": 30, "unit": "seconds", "options": {}}
    },
    {
      "id": "http-generate",
      "name": "Generate Article",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [880, 304],
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/api/clients/{{ \$('Set Client ID').item.json.clientId }}/generate",
        "authentication": "none",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [{"name": "count", "value": 1}, {"name": "publish", "value": true}]
        },
        "options": {
          "timeout": 120000,
          "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer {{ \$('Login to Vireon').item.json.token }}"}]}
        }
      }
    },
    {
      "id": "http-logs",
      "name": "Fetch Latest Articles",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1088, 304],
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/api/clients/{{ \$('Set Client ID').item.json.clientId }}/articles?status=published&limit=1",
        "authentication": "none",
        "options": {
          "timeout": 15000,
          "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer {{ \$('Login to Vireon').item.json.token }}"}]}
        }
      }
    }
  ],
  "connections": {
    "Schedule Trigger": {"main": [[{"node": "Set Client ID", "type": "main", "index": 0}]]},
    "Set Client ID": {"main": [[{"node": "Login to Vireon", "type": "main", "index": 0}]]},
    "Login to Vireon": {"main": [[{"node": "Discover Keywords", "type": "main", "index": 0}]]},
    "Discover Keywords": {"main": [[{"node": "Message a model", "type": "main", "index": 0}]]},
    "Message a model": {"main": [[{"node": "Wait 30s", "type": "main", "index": 0}]]},
    "Wait 30s": {"main": [[{"node": "Generate Article", "type": "main", "index": 0}]]},
    "Generate Article": {"main": [[{"node": "Fetch Latest Articles", "type": "main", "index": 0}]]}
  },
  "pinData": {},
  "settings": {"executionOrder": "v1"},
  "tags": ["seo", "shopify", "content-generation"],
  "versionId": "da8694dc-150f-467f-a914-1d84f3cf4f72"
}' 2>&1 | python -c "
import sys, json
data = json.load(sys.stdin)
print('Name:', data.get('name', 'FAILED'))
print('Active:', data.get('active', '?'))
print('Nodes:', len(data.get('nodes', [])))
print('Message a model credentials:', data.get('nodes', [{}])[4].get('credentials', 'none'))
print('Set Client ID params:', data.get('nodes', [{}])[1].get('parameters', {})['values']['string'][0]['name'], '=', data.get('nodes', [{}])[1].get('parameters', {})['values']['string'][0]['value'][:8]+'...')
for n in data.get('nodes', []):
    hdrs = n.get('parameters', {}).get('options', {}).get('headerParameters', {})
    if hdrs:
        print('Auth headers on', n['name'], ':', hdrs['parameters'][0]['name'], 'present')
" 2>&1
