import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { encrypt, mask } from '../services/credentialEncryption';

const CLIENTS_DIR = path.resolve(__dirname, '../../doc/clients');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const clientDirs = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  let total = 0;

  for (const slug of clientDirs) {
    const contactsFile = path.join(CLIENTS_DIR, slug, 'contacts.md');
    const techRefFile = path.join(CLIENTS_DIR, slug, 'technical-reference.md');

    if (fs.existsSync(contactsFile)) {
      const content = fs.readFileSync(contactsFile, 'utf8');
      const parsed = parseContacts(slug, content);
      for (const cred of parsed) {
        await insertCredential(pool, slug, cred);
        total++;
      }
    }

    if (fs.existsSync(techRefFile)) {
      const content = fs.readFileSync(techRefFile, 'utf8');
      const parsed = parseTechnicalReference(slug, content);
      for (const cred of parsed) {
        await insertCredential(pool, slug, cred);
        total++;
      }
    }
  }

  console.log(`Imported ${total} credentials from ${clientDirs.length} clients`);
  await pool.end();
}

interface ParsedCredential {
  category: string;
  service: string;
  label: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

function parseContacts(slug: string, content: string): ParsedCredential[] {
  const results: ParsedCredential[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const emailMatch = line.match(/Email(?:[:\s]+)(\S+@\S+)/i);
    const phoneMatch = line.match(/Phone(?:[:\s]+)(.+)/i);
    const nameMatch = line.match(/(?:Name|Person)(?:[:\s]+)(.+)/i);

    if (nameMatch || emailMatch) {
      results.push({
        category: 'other',
        service: slug,
        label: `Contact: ${nameMatch?.[1]?.trim() || emailMatch?.[1]?.trim() || 'Unknown'}`,
        url: '',
        username: emailMatch?.[1] || nameMatch?.[1]?.trim() || '',
        password: '',
        notes: `From contacts.md${phoneMatch ? ` — Phone: ${phoneMatch[1].trim()}` : ''}`,
      });
    }
  }

  return results;
}

function parseTechnicalReference(slug: string, content: string): ParsedCredential[] {
  const results: ParsedCredential[] = [];

  // WordPress admin URLs with credentials
  const wpPatterns = [
    /WordPress\s*Admin:?\s*(https?:\/\/\S+)/i,
    /Admin\s*URL:?\s*(https?:\/\/\S+\/wp-admin)/i,
    /wp-admin:?\s*(https?:\/\/\S+)/i,
  ];

  for (const pat of wpPatterns) {
    const m = content.match(pat);
    if (m) {
      results.push({
        category: 'wordpress',
        service: slug,
        label: 'WordPress Admin',
        url: m[1],
        username: '',
        password: '',
        notes: '',
      });
    }
  }

  // Username / password pairs
  const userPassRegex = /(?:Username|User|Email):\s*(\S+)\s*(?:\n|.){0,3}(?:Password|Pass):\s*(\S+)/gi;
  let upMatch;
  while ((upMatch = userPassRegex.exec(content)) !== null) {
    results.push({
      category: detectCategory(content, slug),
      service: slug,
      label: detectLabel(content, upMatch[0]),
      url: '',
      username: upMatch[1].replace(/[`*]/g, ''),
      password: upMatch[2].replace(/[`*]/g, ''),
      notes: '',
    });
  }

  // Database credentials
  const dbMatch = content.match(/DB_?(?:Name|Database):\s*(\S+)/i);
  const dbUser = content.match(/DB_?(?:User):\s*(\S+)/i);
  const dbPass = content.match(/DB_?(?:Password):\s*(\S+)/i);
  const dbHost = content.match(/DB_?(?:Host):\s*(\S+)/i);

  if (dbPass || dbUser) {
    results.push({
      category: 'database',
      service: slug,
      label: 'Database',
      url: dbHost?.[1] || '',
      username: dbUser?.[1] || '',
      password: dbPass?.[1] || '',
      notes: dbMatch ? `Database: ${dbMatch[1]}` : '',
    });
  }

  // API keys
  const apiKeys = content.matchAll(/(?:API\s*Key|ApiKey|api_key|access_token|AccessToken):\s*(\S+)/gi);
  for (const ak of apiKeys) {
    results.push({
      category: 'api',
      service: slug,
      label: 'API Key',
      url: '',
      username: '',
      password: ak[1],
      notes: '',
    });
  }

  // Hosting / server
  if (content.match(/SSH|server|hosting|cPanel|WHM|Plesk|vps|VPS/i)) {
    const hostMatch = content.match(/(?:Host|Server|IP|Address):\s*(\S+)/i);
    results.push({
      category: 'server',
      service: slug,
      label: 'Server Access',
      url: hostMatch?.[1] || '',
      username: content.match(/(?:SSH\s*)?User(?:name)?:\s*(\S+)/i)?.[1] || '',
      password: content.match(/(?:SSH\s*)?Password:\s*(\S+)/i)?.[1] || '',
      notes: 'From technical-reference.md',
    });
  }

  return results;
}

function detectCategory(content: string, _context: string): string {
  if (/wp[-_]?admin|wordpress/i.test(content)) return 'wordpress';
  if (/smtp|mail|email|imap|pop3/i.test(content)) return 'email';
  if (/api|key|token|secret/i.test(content)) return 'api';
  if (/ssh|ftp|sftp|server|hosting/i.test(content)) return 'server';
  if (/db_|database|mysql|postgres/i.test(content)) return 'database';
  return 'other';
}

function detectLabel(_content: string, context: string): string {
  if (/wp[-_]?admin|wordpress/i.test(context)) return 'WordPress Login';
  if (/smtp|mail/i.test(context)) return 'Email';
  if (/api/i.test(context)) return 'API Credential';
  if (/ssh/i.test(context)) return 'SSH Login';
  return 'Login';
}

async function insertCredential(pool: Pool, slug: string, cred: ParsedCredential) {
  const encUser = cred.username ? encrypt(cred.username) : '';
  const encPass = cred.password ? encrypt(cred.password) : '';
  const encNotes = cred.notes ? encrypt(cred.notes) : '';

  try {
    await pool.query(
      `INSERT INTO credential_vault
       (category, service, label, url, username, password, notes, masked_username, masked_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      [cred.category, cred.service, cred.label, cred.url,
       encUser || null, encPass || null, encNotes || null,
       cred.username ? mask(cred.username) : null,
       cred.password ? mask(cred.password) : null]
    );
  } catch (err) {
    console.error(`Failed to insert ${cred.service}/${cred.label}:`, (err as Error).message);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
