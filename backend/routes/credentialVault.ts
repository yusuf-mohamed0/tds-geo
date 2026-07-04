// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { encrypt, decrypt, mask } from '../services/credentialEncryption';

export function createCredentialVaultRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  function getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '0.0.0.0';
  }

  async function logAccess(credentialId: string, userId: string | undefined, action: string, ip: string, meta: any = {}) {
    try {
      await pool.query(
        `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [credentialId, userId, action, ip, JSON.stringify(meta)]
      );
    } catch (err) {
      logger.error('Failed to log credential access', { credentialId, action, error: (err as Error).message });
    }
  }

  // ── LIST ────────────────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, service, q } = req.query;
      const params: any[] = [];
      const conditions: string[] = ['deleted_at IS NULL'];

      if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
      if (service) { params.push(service); conditions.push(`service = $${params.length}`); }
      if (q) { params.push(`%${q}%`); conditions.push(`(label ILIKE $${params.length} OR service ILIKE $${params.length})`); }

      const result = await pool.query(
        `SELECT id, category, service, label, tags, url,
                masked_username, masked_password,
                expires_at, rotation_days, last_used_at,
                created_by, created_at, updated_at
         FROM credential_vault
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC`,
        params
      );

      res.json({ credentials: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  // ── GET (single — decrypts secrets, logged) ─
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT * FROM credential_vault WHERE id = $1 AND deleted_at IS NULL`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      const row = result.rows[0];
      const user = (req as any).user;
      const ip = getClientIp(req);

      await logAccess(row.id, user?.id, 'view', ip);

      await pool.query(
        `UPDATE credential_vault SET last_used_at = NOW() WHERE id = $1`,
        [row.id]
      );

      let decryptedUsername = '';
      let decryptedPassword = '';
      let decryptedNotes = '';
      try {
        if (row.username) decryptedUsername = decrypt(row.username);
        if (row.password) decryptedPassword = decrypt(row.password);
        if (row.notes) decryptedNotes = decrypt(row.notes);
      } catch {
        logger.warn('Failed to decrypt credential', { id: row.id });
      }

      res.json({
        ...row,
        username: decryptedUsername,
        password: decryptedPassword,
        notes: decryptedNotes,
      });
    } catch (err) { next(err); }
  });

  // ── CREATE ──────────────────────────────────
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, service, label, tags, url, username, password, notes, expiresAt, rotationDays, clientId } = req.body;
      if (!category || !service || !label) {
        res.status(400).json({ error: 'category, service, and label are required' });
        return;
      }

      const user = (req as any).user;
      const encryptedUser = username ? encrypt(username) : '';
      const encryptedPass = password ? encrypt(password) : '';
      const encryptedNotes = notes ? encrypt(notes) : '';
      const maskedUser = username ? mask(username) : '';
      const maskedPass = password ? mask(password) : '';

      const result = await pool.query(
        `INSERT INTO credential_vault
         (client_id, category, service, label, tags, url,
          username, password, notes,
          masked_username, masked_password,
          expires_at, rotation_days, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, category, service, label, tags, url,
                   masked_username, masked_password,
                   expires_at, rotation_days, created_at`,
        [clientId || null, category, service, label, tags || [], url || '',
         encryptedUser || null, encryptedPass || null, encryptedNotes || null,
         maskedUser || null, maskedPass || null,
         expiresAt || null, rotationDays || 90, user?.id || null]
      );

      const ip = getClientIp(req);
      await logAccess(result.rows[0].id, user?.id, 'create', ip);

      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ── UPDATE ──────────────────────────────────
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, notes, label, tags, url, category, service, expiresAt, rotationDays } = req.body;
      const existing = await pool.query(
        `SELECT * FROM credential_vault WHERE id = $1 AND deleted_at IS NULL`,
        [req.params.id]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      const setField = (field: string, value: any) => {
        if (value !== undefined) {
          updates.push(`${field} = $${idx++}`);
          params.push(value);
        }
      };

      setField('label', label);
      setField('category', category);
      setField('service', service);
      setField('url', url);
      setField('tags', tags);
      setField('expires_at', expiresAt);
      setField('rotation_days', rotationDays);

      if (username !== undefined) {
        const enc = username ? encrypt(username) : '';
        updates.push(`username = $${idx++}`); params.push(enc || null);
        updates.push(`masked_username = $${idx++}`); params.push(username ? mask(username) : '');
      }
      if (password !== undefined) {
        const enc = password ? encrypt(password) : '';
        updates.push(`password = $${idx++}`); params.push(enc || null);
        updates.push(`masked_password = $${idx++}`); params.push(password ? mask(password) : '');
      }
      if (notes !== undefined) {
        updates.push(`notes = $${idx++}`); params.push(notes ? encrypt(notes) : null);
      }

      if (updates.length === 0) {
        res.json(existing.rows[0]);
        return;
      }

      updates.push(`updated_at = NOW()`);
      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE credential_vault SET ${updates.join(', ')} WHERE id = $${idx}
         RETURNING id, category, service, label, tags, url,
                   masked_username, masked_password,
                   expires_at, rotation_days, updated_at`,
        params
      );

      const user = (req as any).user;
      await logAccess(req.params.id, user?.id, 'update', getClientIp(req));

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ── DELETE (soft) ───────────────────────────
  router.delete('/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `UPDATE credential_vault SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, label, service`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }
      const user = (req as any).user;
      await logAccess(req.params.id, user?.id, 'delete', getClientIp(req));
      res.json({ message: 'Credential deleted' });
    } catch (err) { next(err); }
  });

  // ── ROTATE (generate new password) ──────────
  router.post('/:id/rotate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await pool.query(
        `SELECT * FROM credential_vault WHERE id = $1 AND deleted_at IS NULL`,
        [req.params.id]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      const newPassword = generatePassword();
      const encryptedPass = encrypt(newPassword);
      const maskedPass = mask(newPassword);

      await pool.query(
        `UPDATE credential_vault SET password = $1, masked_password = $2, updated_at = NOW()
         WHERE id = $3`,
        [encryptedPass, maskedPass, req.params.id]
      );

      const user = (req as any).user;
      await logAccess(req.params.id, user?.id, 'rotate', getClientIp(req), { generated: true });

      res.json({
        message: 'Password rotated',
        newPassword,
        maskedPassword: maskedPass,
      });
    } catch (err) { next(err); }
  });

  // ── EXPORT (encrypted JSON dump) ────────────
  router.get('/export/all', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT * FROM credential_vault WHERE deleted_at IS NULL ORDER BY service, label`
      );
      const user = (req as any).user;
      for (const row of result.rows) {
        await logAccess(row.id, user?.id, 'export', getClientIp(req));
      }
      res.json({ exportedAt: new Date().toISOString(), count: result.rows.length, credentials: result.rows });
    } catch (err) { next(err); }
  });

  // ── IMPORT (from encrypted JSON) ────────────
  router.post('/import', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { credentials } = req.body;
      if (!Array.isArray(credentials) || credentials.length === 0) {
        res.status(400).json({ error: 'credentials array is required' });
        return;
      }

      const user = (req as any).user;
      let imported = 0;

      for (const cred of credentials) {
        const encryptedUser = cred.username ? encrypt(cred.username) : '';
        const encryptedPass = cred.password ? encrypt(cred.password) : '';
        const encryptedNotes = cred.notes ? encrypt(cred.notes) : '';
        const maskedUser = cred.username ? mask(cred.username) : '';
        const maskedPass = cred.password ? mask(cred.password) : '';

        await pool.query(
          `INSERT INTO credential_vault
           (category, service, label, tags, url, username, password, notes,
            masked_username, masked_password, expires_at, rotation_days, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT DO NOTHING`,
          [cred.category || 'other', cred.service, cred.label, cred.tags || [],
           cred.url || '', encryptedUser || null, encryptedPass || null, encryptedNotes || null,
           maskedUser || null, maskedPass || null, cred.expires_at || null,
           cred.rotation_days || 90, user?.id || null]
        );
        imported++;
      }

      await pool.query(
        `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, metadata)
         VALUES (NULL, $1, 'import', $2, $3)`,
        [user?.id, getClientIp(req), JSON.stringify({ count: imported })]
      );

      res.json({ message: `Imported ${imported} credentials` });
    } catch (err) { next(err); }
  });

  return router;
}

function generatePassword(length = 24): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + digits + special;
  let pw = '';
  pw += upper[cryptoRandomInt(upper.length)];
  pw += lower[cryptoRandomInt(lower.length)];
  pw += digits[cryptoRandomInt(digits.length)];
  pw += special[cryptoRandomInt(special.length)];
  for (let i = pw.length; i < length; i++) {
    pw += all[cryptoRandomInt(all.length)];
  }
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

function cryptoRandomInt(max: number): number {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32BE(0) % max;
}
