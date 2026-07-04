#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/tds-geo

# Load .env safely via node to avoid bash parsing issues with special chars
eval "$(node -e "
const fs = require('fs');
const env = fs.readFileSync('.env','utf8');
env.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).forEach(l=>{
  const eq = l.indexOf('=');
  if(eq>0) console.log('export ' + l.substring(0,eq) + '=' + JSON.stringify(l.substring(eq+1)));
});
")"

export DATABASE_URL JWT_SECRET BASE_URL

COMMAND="${1:-daily}"
exec node scripts/monthly-ops.mjs "$COMMAND"
