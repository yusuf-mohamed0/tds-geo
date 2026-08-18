// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import crypto from 'crypto';

function getMasterKey(): string {
  const key = process.env.CREDENTIAL_VAULT_KEY || process.env.ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CREDENTIAL_VAULT_KEY is required in production. '
      + 'Set it before starting the server — existing encrypted data will be UNRECOVERABLE without the correct key. '
      + 'Generate: openssl rand -hex 32'
    );
  }
  return key || crypto.randomBytes(32).toString('hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(getMasterKey().slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length < 3) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts.slice(2).join(':');
  const key = Buffer.from(getMasterKey().slice(0, 64), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function mask(value: string): string {
  if (value.length <= 8) return value;
  return value.slice(0, 4) + '...' + value.slice(-4);
}

// Returns the decrypted value if it looks like ciphertext, else returns the value as-is.
// NEVER throw on plaintext passthrough; DO throw loudly if value looks like ciphertext but fails to decrypt.
export function maybeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^[0-9a-f]{32}:[0-9a-f]{32}:/.test(value)) {
    return decrypt(value); // decrypt() already throws on bad tag → loud failure is desired
  }
  return value;
}

export function maybeMask(value: string | null | undefined): string | null {
  if (!value) return null;
  return mask(value);
}
