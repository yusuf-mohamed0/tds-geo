import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import { decrypt } from '../services/credentialEncryption';

dotenv.config({ path: process.env.DOTENV_PATH || path.join(__dirname, '../../.env') });

const PORT = parseInt(process.env.VAULT_UI_PORT || '3456', 10);
const PAGE_PASSWORD = process.env.VAULT_PAGE_PASSWORD || 'TrafficDSgeo@2024';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

const sessions = new Map<string, { createdAt: number }>();

app.use(express.json());
const vaultDir = process.env.VAULT_UI_DIR || path.join(__dirname);
app.use(express.static(vaultDir));

function requireSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-vault-token'] as string;
  if (!token || !sessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = sessions.get(token)!;
  if (Date.now() - session.createdAt > 3600000) {
    sessions.delete(token);
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  next();
}

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password !== PAGE_PASSWORD) {
    res.status(403).json({ error: 'Invalid password' });
    return;
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  res.json({ token });
});

app.get('/api/credentials', requireSession, async (req, res, next) => {
  try {
    const { category, service } = req.query;
    const params: any[] = [];
    const conds: string[] = ['deleted_at IS NULL'];
    if (category) { params.push(category); conds.push(`category = $${params.length}`); }
    if (service) { params.push(service); conds.push(`service = $${params.length}`); }
    const result = await pool.query(
      `SELECT id, category, service, label, tags, url, masked_username, masked_password,
              expires_at, last_used_at, created_at
       FROM credential_vault WHERE ${conds.join(' AND ')}
       ORDER BY service, label`,
      params
    );
    res.json({ credentials: result.rows });
  } catch (err) { next(err); }
});

app.get('/api/credentials/:id', requireSession, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM credential_vault WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const row = result.rows[0];
    let username = '', password = '', notes = '';
    try { if (row.username) username = decrypt(row.username); } catch {}
    try { if (row.password) password = decrypt(row.password); } catch {}
    try { if (row.notes) notes = decrypt(row.notes); } catch {}
    res.json({ ...row, username, password, notes });
  } catch (err) { next(err); }
});

app.listen(PORT, () => {
  console.log(`Vault UI: http://localhost:${PORT}`);
  console.log(`Password: ${PAGE_PASSWORD}`);
});
