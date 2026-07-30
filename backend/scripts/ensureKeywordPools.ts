import 'dotenv/config';
import { Pool } from 'pg';
import { ensureAllActiveKeywordPools } from '../services/keywordPool';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const results = await ensureAllActiveKeywordPools(pool);
    for (const result of results) console.log(`${result.client}: ${result.active} active keywords (${result.added} added, ${result.researchCount} AI research candidates)`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
