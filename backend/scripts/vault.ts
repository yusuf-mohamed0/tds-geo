#!/usr/bin/env tsx
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import { Pool } from 'pg';
import { encrypt, decrypt, mask } from '../services/credentialEncryption';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [command, ...args] = process.argv.slice(2);

async function main() {
  switch (command) {
    case 'list':
      return list(args[0], args[1]);
    case 'get':
      return get(args[0]);
    case 'set':
      return set(args[0], args[1], args[2], args.slice(3));
    case 'del':
      return del(args[0]);
    case 'rotate':
      return rotate(args[0]);
    case 'export':
      return exportAll();
    case 'import':
      return importFromFile(args[0]);
    default:
      console.log(`
tds vault <command> [options]

Commands:
  list [category] [service]    List credentials (masked)
  get <id>                     Get credential (decrypted)
  set <service> <label> [cat]  Create a credential (interactive)
  del <id>                     Soft-delete a credential
  rotate <id>                  Generate new password
  export                       Export all credentials (encrypted JSON)
  import <file>                Import from JSON file

Examples:
  tds vault list
  tds vault list wordpress boston-vet
  tds vault get <uuid>
      `);
  }
  await pool.end();
}

async function list(category?: string, service?: string) {
  const params: any[] = [];
  const conds: string[] = ['deleted_at IS NULL'];
  if (category) { params.push(category); conds.push(`category = $${params.length}`); }
  if (service) { params.push(service); conds.push(`service = $${params.length}`); }
  const { rows } = await pool.query(
    `SELECT id, category, service, label, tags, url,
            masked_username, masked_password,
            expires_at, last_used_at
     FROM credential_vault WHERE ${conds.join(' AND ')}
     ORDER BY service, label`,
    params
  );
  console.table(rows, ['id', 'category', 'service', 'label', 'masked_username', 'masked_password', 'url']);
}

async function get(id: string) {
  const { rows } = await pool.query('SELECT * FROM credential_vault WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!rows.length) { console.log('Not found'); return; }
  const r = rows[0];
  let user = r.username, pass = r.password, notes = r.notes;
  try { if (user) user = decrypt(user); } catch { /* decryption failed — leave masked */ }
  try { if (pass) pass = decrypt(pass); } catch { /* decryption failed — leave masked */ }
  try { if (notes) notes = decrypt(notes); } catch { /* decryption failed — leave masked */ }
  console.log(`ID:       ${r.id}`);
  console.log(`Service:  ${r.service}`);
  console.log(`Label:    ${r.label}`);
  console.log(`Category: ${r.category}`);
  console.log(`URL:      ${r.url}`);
  console.log(`Username: ${user}`);
  console.log(`Password: ${pass}`);
  console.log(`Notes:    ${notes}`);
  console.log(`Expires:  ${r.expires_at || 'never'}`);
  console.log(`Tags:     ${(r.tags || []).join(', ')}`);
}

async function set(service: string, label: string, category = 'other', tags: string[] = []) {
  console.log('Creating credential… (values read from stdin)');
  const url = await prompt('URL: ');
  const username = await prompt('Username: ');
  const password = await prompt('Password: ');
  const notes = await prompt('Notes: ');

  const encUser = username ? encrypt(username) : '';
  const encPass = password ? encrypt(password) : '';
  const encNotes = notes ? encrypt(notes) : '';

  const { rows } = await pool.query(
    `INSERT INTO credential_vault (category, service, label, tags, url, username, password, notes, masked_username, masked_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, category, service, label`,
    [category, service, label, tags, url, encUser || null, encPass || null, encNotes || null,
     username ? mask(username) : null, password ? mask(password) : null]
  );
  console.log('Created:', rows[0].id);
}

async function del(id: string) {
  const { rowCount } = await pool.query('UPDATE credential_vault SET deleted_at = NOW() WHERE id = $1', [id]);
  console.log(rowCount ? 'Deleted' : 'Not found');
}

async function rotate(id: string) {
  const { rows } = await pool.query('SELECT id FROM credential_vault WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!rows.length) { console.log('Not found'); return; }
  const pw = generatePassword();
  await pool.query('UPDATE credential_vault SET password = $1, masked_password = $2, updated_at = NOW() WHERE id = $3',
    [encrypt(pw), mask(pw), id]);
  console.log('New password:', pw);
}

async function exportAll() {
  const { rows } = await pool.query('SELECT * FROM credential_vault WHERE deleted_at IS NULL');
  process.stdout.write(JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, credentials: rows }, null, 2));
}

async function importFromFile(file: string) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const credentials = data.credentials || data;
  if (!Array.isArray(credentials)) { console.log('Invalid format'); return; }
  let count = 0;
  for (const c of credentials) {
    const eu = c.username ? encrypt(c.username) : '';
    const ep = c.password ? encrypt(c.password) : '';
    const en = c.notes ? encrypt(c.notes) : '';
    await pool.query(
      `INSERT INTO credential_vault (category, service, label, tags, url, username, password, notes, masked_username, masked_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
      [c.category || 'other', c.service, c.label, c.tags || [], c.url || '',
       eu || null, ep || null, en || null,
       c.username ? mask(c.username) : null, c.password ? mask(c.password) : null]
    );
    count++;
  }
  console.log(`Imported ${count} credentials`);
}

function prompt(q: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(q);
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });
}

function generatePassword(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

main().catch(err => { console.error(err); process.exit(1); });
