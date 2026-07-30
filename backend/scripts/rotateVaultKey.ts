import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const OLD_KEY = process.argv[2] || process.env.CREDENTIAL_VAULT_KEY_OLD || process.env.CREDENTIAL_VAULT_KEY;
const NEW_KEY = process.argv[3] || process.env.CREDENTIAL_VAULT_KEY;

if (!OLD_KEY) {
  console.error('ERROR: Old vault key required. Pass as arg or set CREDENTIAL_VAULT_KEY_OLD');
  process.exit(1);
}
if (!NEW_KEY) {
  console.error('ERROR: New vault key required. Pass as arg or set CREDENTIAL_VAULT_KEY');
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error('ERROR: Old and new keys are identical — nothing to rotate');
  process.exit(1);
}

const OLD_KEY_BUF = Buffer.from(OLD_KEY.slice(0, 64), 'hex');
const NEW_KEY_BUF = Buffer.from(NEW_KEY.slice(0, 64), 'hex');

function decryptWith(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(':');
  if (parts.length < 3) throw new Error('Invalid ciphertext');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts.slice(2).join(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

function encryptWith(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

async function rotate() {
  const client = await pool.connect();

  try {
    const { rows: credentials } = await client.query(
      'SELECT id, username, password, notes FROM credential_vault WHERE deleted_at IS NULL'
    );

    console.log(`Found ${credentials.length} credentials to rotate`);

    for (const cred of credentials) {
      const fields: Record<string, string> = {};
      for (const field of ['username', 'password', 'notes']) {
        const val = cred[field];
        if (val) {
          const decrypted = decryptWith(val, OLD_KEY_BUF);
          fields[field] = encryptWith(decrypted, NEW_KEY_BUF);
        }
      }

      if (Object.keys(fields).length === 0) continue;

      const setClauses = Object.entries(fields)
        .map(([k], i) => `${k} = $${i + 1}`)
        .join(', ');

      await client.query(
        `UPDATE credential_vault SET ${setClauses} WHERE id = $${Object.keys(fields).length + 1}`,
        [...Object.values(fields), cred.id]
      );

      console.log(`  Rotated credential ${cred.id}`);
    }

    console.log('Rotation complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

rotate().catch((err) => {
  console.error('Rotation failed:', err);
  process.exit(1);
});
