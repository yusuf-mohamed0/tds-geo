#!/bin/bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
set -e

# Get OpenAI API key
OPENAI_KEY=$(grep OPENAI_API_KEY /root/my-project/.env | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
echo "KEY_PREFIX: ${OPENAI_KEY:0:20}..."

# Create OpenAI credential
CRED=$(curl -s -b /tmp/n8n-cookies.txt -X POST http://localhost:5678/rest/credentials \
  -H 'Content-Type: application/json' \
  -d '{"name":"OpenAI API","type":"openAiApi","data":{"apiKey":"'"$OPENAI_KEY"'"},"projectId":"raxMoWrfeOFUOzrL"}')
echo "CRED: $CRED"
CRED_ID=$(echo "$CRED" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "CRED_ID: $CRED_ID"

# Get client ID from DB
CLIENT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d ai_seo_automation -t -c "SELECT id FROM clients WHERE slug='acme-maintenance' LIMIT 1;" | tr -d ' ')
echo "CLIENT_ID: $CLIENT_ID"

# Save for later use
echo "$CLIENT_ID" > /tmp/n8n-client-id.txt
echo "$CRED_ID" > /tmp/n8n-cred-id.txt
echo "Done"
