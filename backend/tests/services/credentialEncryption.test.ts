// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, mask, maybeDecrypt, maybeMask } from '../../services/credentialEncryption';

process.env.CREDENTIAL_VAULT_KEY = 'a'.repeat(64);

describe('credentialEncryption', () => {
  it('round-trips encrypt/decrypt', () => {
    const plaintext = 'shpat_1234567890abcdef';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:/);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces unique ciphertext per call (random IV)', () => {
    const plaintext = 'same-value';
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it('mask returns first4+...+last4 for long values', () => {
    expect(mask('shpat_1234567890abcdef')).toBe('shpa...cdef');
  });

  it('mask passes through short values', () => {
    expect(mask('short')).toBe('short');
  });

  it('maybeDecrypt passes plaintext through untouched', () => {
    expect(maybeDecrypt('shpat_plaintext_token')).toBe('shpat_plaintext_token');
  });

  it('maybeDecrypt decrypts ciphertext', () => {
    const ciphertext = encrypt('secret-value');
    expect(maybeDecrypt(ciphertext)).toBe('secret-value');
  });

  it('maybeDecrypt returns null for empty values', () => {
    expect(maybeDecrypt(null)).toBeNull();
    expect(maybeDecrypt(undefined)).toBeNull();
    expect(maybeDecrypt('')).toBeNull();
  });

  it('maybeDecrypt throws on malformed ciphertext', () => {
    const malformed = 'a'.repeat(32) + ':' + 'b'.repeat(32) + ':' + 'zz';
    expect(() => maybeDecrypt(malformed)).toThrow();
  });

  it('maybeMask returns null for empty values', () => {
    expect(maybeMask(null)).toBeNull();
    expect(maybeMask('')).toBeNull();
  });

  it('maybeMask masks values', () => {
    expect(maybeMask('shpat_1234567890abcdef')).toBe('shpa...cdef');
  });
});