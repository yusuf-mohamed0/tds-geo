// ──────────────────────────────────────────────
// n8n Server Launcher
// Starts n8n programmatically via its internal APIs
// ──────────────────────────────────────────────

import 'dotenv/config';

// Set n8n environment
process.env.N8N_PORT = process.env.N8N_PORT || '5678';
process.env.N8N_DB_TYPE = 'sqlite';
process.env.N8N_DB_SQLITE_DATABASE = process.env.HOME + '/.n8n/database.sqlite';
process.env.N8N_DB_SQLITE_POOL_SIZE = '2';
process.env.N8N_PAYLOAD_SIZE_MAX = '16';
process.env.N8N_METRICS = 'false';
process.env.N8N_SKIP_WEBHOOK_DEREGISTRATION_SHUTDOWN = 'true';

// Set config directory to n8n's own config
process.env.NODE_CONFIG_DIR = new URL('../node_modules/n8n/config', import.meta.url).pathname;

console.log('Starting n8n server...');
console.log(`Port: ${process.env.N8N_PORT}`);
console.log(`DB: SQLite (${process.env.N8N_DB_SQLITE_DATABASE})`);
console.log(`Config: ${process.env.NODE_CONFIG_DIR}`);

// Dynamically import n8n's bootstrapper
try {
  // The n8n bin script sets up reflect-metadata and source-map-support
  await import('reflect-metadata');
  
  // Load the command registry and let it run
  const { default: CommandRegistry } = await import('../node_modules/n8n/dist/command-registry.js');
  
  const registry = new CommandRegistry();
  await registry.execute();
  
  console.log('n8n server started successfully!');
} catch (err) {
  console.error('Failed to start n8n:', err.message);
  process.exit(1);
}
