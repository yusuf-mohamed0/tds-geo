import { Pool } from 'pg';
import MultiCmsPublisher from '../services/multiCmsPublisher';

async function main() {
  const pool = new Pool({
    host: '/var/run/postgresql',
    database: 'ai_seo_automation',
    user: 'postgres',
  });

  MultiCmsPublisher.initialize(pool);

  const clientId = process.argv[2];
  if (!clientId) {
    console.error('Usage: tsx backend/scripts/run-sync.ts <clientId> [connectionId]');
    console.log('\nAvailable clients:');
    const clients = await pool.query('SELECT id, name, slug FROM clients ORDER BY name');
    for (const c of clients.rows) {
      console.log(`  ${c.id} | ${c.name} (${c.slug})`);
    }
    await pool.end();
    return;
  }

  const connectionId = process.argv[3] || undefined;
  console.log(`Starting sync for client ${clientId}${connectionId ? ' connection ' + connectionId : ''}...`);
  const result = await MultiCmsPublisher.syncFromWordPress(clientId, connectionId);
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
