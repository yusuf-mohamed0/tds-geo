// ══════════════════════════════════════════════
// Device Authorization Service
// Fingerprint hashing, enrollment, trust scoring,
// session management, and remote device revocation
// ══════════════════════════════════════════════

import { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { DeviceFingerprint, DeviceRegistration, EmployeeSession } from '../types';

const DEVICE_SALT = process.env.DEVICE_FINGERPRINT_SALT || 'vireon-device-fingerprint-salt-change-in-production';

export class DeviceAuthService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Device auth service initialized');
  }

  // ─── Fingerprint Hashing ──────────────────────

  /**
   * Create a deterministic hash from device fingerprint components.
   * Uses crypto.createHash for consistent cross-platform hashing.
   */
  hashFingerprint(fp: DeviceFingerprint): string {
    const components = [
      fp.cpuIdentifier || '',
      fp.macHash || '',
      fp.osSerialHash || '',
      fp.certThumbprint || '',
      fp.browserFingerprint || '',
      fp.platform || '',
      DEVICE_SALT,
    ].join('|');

    return createHash('sha256').update(components).digest('hex');
  }

  /**
   * Hash individual components for forensic analysis.
   */
  hashComponent(value: string): string {
    if (!value) return '';
    return createHash('sha256').update(value + DEVICE_SALT).digest('hex').slice(0, 16);
  }

  // ─── Device Enrollment ────────────────────────

  /**
   * Register a device for an employee.
   * Auto-calculates initial trust score from fingerprint completeness.
   */
  async enrollDevice(
    employeeId: string,
    fingerprint: DeviceFingerprint,
    deviceName?: string,
    enrolledBy?: string
  ): Promise<DeviceRegistration> {
    if (!this.pool) throw new Error('DeviceAuthService not initialized');

    const fpHash = this.hashFingerprint(fingerprint);
    const trustScore = this.calculateInitialTrustScore(fingerprint);

    const result = await this.pool.query(
      `INSERT INTO device_registry
         (employee_id, device_fingerprint_hash, device_name, device_type,
          cpu_identifier, mac_hash, os_serial_hash, cert_thumbprint,
          browser_fingerprint, trust_score, enrolled_by, last_seen_at, last_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12::inet)
       ON CONFLICT (employee_id, device_fingerprint_hash)
       DO UPDATE SET
         last_seen_at = NOW(),
         trust_score = GREATEST(device_registry.trust_score, $10),
         is_revoked = false,
         updated_at = NOW()
       RETURNING *`,
      [
        employeeId,
        fpHash,
        deviceName || `${fingerprint.platform || 'Unknown'} Device`,
        this.inferDeviceType(fingerprint),
        this.hashComponent(fingerprint.cpuIdentifier || ''),
        this.hashComponent(fingerprint.macHash || ''),
        this.hashComponent(fingerprint.osSerialHash || ''),
        fingerprint.certThumbprint ? this.hashComponent(fingerprint.certThumbprint) : null,
        this.hashComponent(fingerprint.browserFingerprint || ''),
        trustScore,
        enrolledBy || employeeId,
        fingerprint.ipAddress || '0.0.0.0',
      ]
    );

    const row = result.rows[0];

    // Log enrollment
    await this.logDeviceAction(employeeId, row.id, 'device_enrolled', {
      deviceName,
      trustScore,
      platform: fingerprint.platform,
    });

    logger.info('Device enrolled', {
      employeeId,
      deviceId: row.id,
      trustScore,
    });

    return this.mapDeviceRegistration(row);
  }

  /**
   * Verify a device is registered, not revoked, and has sufficient trust score.
   */
  async verifyDevice(
    employeeId: string,
    fingerprintHash: string
  ): Promise<{ valid: boolean; device?: DeviceRegistration; reason?: string }> {
    if (!this.pool) throw new Error('DeviceAuthService not initialized');

    const result = await this.pool.query(
      `SELECT * FROM device_registry
       WHERE employee_id = $1 AND device_fingerprint_hash = $2
       LIMIT 1`,
      [employeeId, fingerprintHash]
    );

    if (result.rows.length === 0) {
      return { valid: false, reason: 'Device not registered' };
    }

    const device = result.rows[0];

    if (device.is_revoked) {
      return {
        valid: false,
        device: this.mapDeviceRegistration(device),
        reason: device.revocation_reason || 'Device has been revoked',
      };
    }

    const minTrustScore = parseInt(process.env.DEVICE_MIN_TRUST_SCORE || '30', 10);
    if (device.trust_score < minTrustScore) {
      return {
        valid: false,
        device: this.mapDeviceRegistration(device),
        reason: `Device trust score too low: ${device.trust_score} < ${minTrustScore}`,
      };
    }

    return { valid: true, device: this.mapDeviceRegistration(device) };
  }

  // ─── Session Management ───────────────────────

  /**
   * Create a device-bound session record.
   */
  async createSession(
    userId: string,
    deviceId: string,
    tokenJti: string,
    ipAddress: string,
    userAgent: string,
    ttlHours: number = 24
  ): Promise<EmployeeSession> {
    if (!this.pool) throw new Error('DeviceAuthService not initialized');

    // Terminate any existing active sessions for this device
    await this.pool.query(
      `UPDATE employee_sessions SET
         is_active = false, terminated_at = NOW(),
         termination_reason = 'new_session'
       WHERE user_id = $1 AND device_id = $2 AND is_active = true`,
      [userId, deviceId]
    );

    const result = await this.pool.query(
      `INSERT INTO employee_sessions
         (user_id, device_id, token_jti, ip_address, user_agent,
          risk_score, expires_at)
       VALUES ($1, $2, $3, $4::inet, $5, $6, NOW() + ($7 || ' hours')::interval)
       RETURNING *`,
      [
        userId,
        deviceId,
        tokenJti,
        ipAddress,
        userAgent,
        0, // initial risk score
        ttlHours,
      ]
    );

    await this.logDeviceAction(userId, deviceId, 'session_created', {
      jti: tokenJti.slice(0, 8),
      ipAddress,
      ttlHours,
    });

    return this.mapEmployeeSession(result.rows[0]);
  }

  /**
   * Validate an active session exists for the given JWT jti and device fingerprint.
   */
  async validateSession(tokenJti: string, deviceFingerprintHash: string): Promise<boolean> {
    if (!this.pool) return false;

    const result = await this.pool.query(
      `SELECT es.id FROM employee_sessions es
       JOIN device_registry dr ON dr.id = es.device_id
       WHERE es.token_jti = $1
         AND es.is_active = true
         AND es.expires_at > NOW()
         AND dr.device_fingerprint_hash = $2
         AND dr.is_revoked = false
       LIMIT 1`,
      [tokenJti, deviceFingerprintHash]
    );

    return result.rows.length > 0;
  }

  /**
   * Terminate a session (logout).
   */
  async terminateSession(tokenJti: string, reason: string = 'user_logout'): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(
      `UPDATE employee_sessions SET
         is_active = false, terminated_at = NOW(),
         termination_reason = $2
       WHERE token_jti = $1`,
      [tokenJti, reason]
    );
  }

  // ─── Device Revocation ────────────────────────

  /**
   * Revoke a device — immediately terminates all active sessions for that device.
   */
  async revokeDevice(
    deviceId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    if (!this.pool) throw new Error('DeviceAuthService not initialized');

    // Revoke the device
    const result = await this.pool.query(
      `UPDATE device_registry SET
         is_revoked = true, revoked_at = NOW(),
         revoked_by = $2, revocation_reason = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING employee_id`,
      [deviceId, revokedBy, reason]
    );

    if (result.rows.length === 0) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const employeeId = result.rows[0].employee_id;

    // Terminate all active sessions for this device
    await this.pool.query(
      `UPDATE employee_sessions SET
         is_active = false, terminated_at = NOW(),
         termination_reason = $3
       WHERE device_id = $1 AND is_active = true`,
      [deviceId, employeeId, `device_revoked: ${reason}`]
    );

    await this.logDeviceAction(employeeId, deviceId, 'device_revoked', {
      revokedBy,
      reason,
    });

    logger.warn('Device revoked', { deviceId, employeeId, reason });
  }

  /**
   * Revoke all sessions for a user (used on password change, account suspension).
   */
  async revokeAllUserSessions(userId: string, excludeJti?: string): Promise<void> {
    if (!this.pool) return;

    const query = excludeJti
      ? `UPDATE employee_sessions SET is_active = false, terminated_at = NOW(),
           termination_reason = 'mass_revocation'
         WHERE user_id = $1 AND token_jti != $2 AND is_active = true`
      : `UPDATE employee_sessions SET is_active = false, terminated_at = NOW(),
           termination_reason = 'mass_revocation'
         WHERE user_id = $1 AND is_active = true`;

    const params = excludeJti ? [userId, excludeJti] : [userId];
    await this.pool.query(query, params);

    await this.logDeviceAction(userId, null, 'sessions_revoked', {
      userId,
      excludeCurrent: !!excludeJti,
    });
  }

  // ─── Trust Score Calculation ──────────────────

  /**
   * Calculate initial trust score based on fingerprint completeness.
   * More fingerprint components = higher trust.
   */
  private calculateInitialTrustScore(fp: DeviceFingerprint): number {
    let score = 30; // Base trust

    // Each available component adds trust
    if (fp.cpuIdentifier) score += 10;
    if (fp.macHash) score += 15;
    if (fp.osSerialHash) score += 15;
    if (fp.certThumbprint) score += 20;
    if (fp.browserFingerprint) score += 10;

    // Platform consistency
    if (fp.platform && fp.platform.length > 0) score += 5;
    if (fp.userAgent && fp.userAgent.length > 10) score += 5;

    // Screen resolution is a weak signal but helps
    if (fp.screenResolution) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Recalculate trust score over time based on usage patterns.
   */
  async recalculateTrustScore(deviceId: string): Promise<number> {
    if (!this.pool) return 0;

    const result = await this.pool.query(
      `SELECT
         trust_score,
         last_seen_at,
         (SELECT COUNT(*) FROM employee_sessions WHERE device_id = $1) as session_count,
         (SELECT COUNT(*) FROM device_audit_log WHERE device_id = $1 AND action IN ('auth_failure', 'suspicious_activity')) as flags
       FROM device_registry WHERE id = $1`,
      [deviceId]
    );

    if (result.rows.length === 0) return 0;

    const row = result.rows[0];
    let score = row.trust_score;

    // Boost for consistent usage
    const daysSinceLastSeen = row.last_seen_at
      ? (Date.now() - new Date(row.last_seen_at).getTime()) / 86400000
      : 999;

    if (daysSinceLastSeen < 1) score += 5;
    if (daysSinceLastSeen < 7) score += 3;

    // Penalize for security flags
    score -= (row.flags || 0) * 10;

    // Good session history
    if (row.session_count > 10) score += 5;
    if (row.session_count > 50) score += 5;

    // Update in DB
    const finalScore = Math.min(100, Math.max(0, score));
    await this.pool.query(
      'UPDATE device_registry SET trust_score = $1 WHERE id = $2',
      [finalScore, deviceId]
    );

    return finalScore;
  }

  // ─── Device Listing ───────────────────────────

  /**
   * Get all registered devices for a user.
   */
  async getUserDevices(userId: string): Promise<DeviceRegistration[]> {
    if (!this.pool) return [];

    const result = await this.pool.query(
      `SELECT * FROM device_registry
       WHERE employee_id = $1
       ORDER BY last_seen_at DESC NULLS LAST, created_at DESC`,
      [userId]
    );

    return result.rows.map(r => this.mapDeviceRegistration(r));
  }

  // ─── Risk Assessment ──────────────────────────

  /**
   * Assess the risk of a session based on various factors.
   */
  async assessSessionRisk(
    userId: string,
    deviceId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ riskScore: number; riskFactors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check for IP changes
    if (this.pool) {
      const recentSessions = await this.pool.query(
        `SELECT ip_address FROM employee_sessions
         WHERE user_id = $1 AND device_id = $2
         ORDER BY created_at DESC LIMIT 5`,
        [userId, deviceId]
      );

      if (recentSessions.rows.length > 0) {
        const previousIps = new Set(recentSessions.rows.map(r => r.ip_address));
        if (!previousIps.has(ipAddress)) {
          score += 20;
          factors.push('ip_address_change');
        }
      }
    }

    // Common risk factors
    const knownBotPatterns = [/bot/i, /crawler/i, /python/i, /curl/i, /wget/i];
    for (const pattern of knownBotPatterns) {
      if (pattern.test(userAgent)) {
        score += 30;
        factors.push('automated_user_agent');
        break;
      }
    }

    // Private/known IP ranges get lower risk
    if (ipAddress.startsWith('10.') || ipAddress.startsWith('192.168.') || ipAddress.startsWith('172.')) {
      score -= 10;
    }

    return {
      riskScore: Math.min(100, Math.max(0, score)),
      riskFactors: factors,
    };
  }

  // ─── Device Type Inference ────────────────────

  private inferDeviceType(fp: DeviceFingerprint): string {
    const platform = (fp.platform || '').toLowerCase();
    const ua = (fp.userAgent || '').toLowerCase();

    if (platform.includes('mac') || platform.includes('win') || platform.includes('linux')) {
      return 'desktop';
    }
    if (ua.includes('mobile') || platform.includes('iphone') || platform.includes('android')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || platform.includes('ipad')) {
      return 'tablet';
    }
    return 'unknown';
  }

  // ─── Logging ──────────────────────────────────

  private async logDeviceAction(
    userId: string,
    deviceId: string | null,
    action: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'SELECT log_device_activity($1, $2, $3, $4::jsonb)',
        [userId, deviceId, action, JSON.stringify(details)]
      );
    } catch (err) {
      logger.warn('Failed to log device activity', { error: (err as Error).message });
    }
  }

  // ─── Mappers ──────────────────────────────────

  private mapDeviceRegistration(row: any): DeviceRegistration {
    return {
      id: row.id,
      employeeId: row.employee_id,
      deviceFingerprintHash: row.device_fingerprint_hash,
      deviceName: row.device_name,
      deviceType: row.device_type,
      trustScore: row.trust_score,
      isRevoked: row.is_revoked,
      enrolledAt: row.enrolled_at,
      lastSeenAt: row.last_seen_at,
    };
  }

  private mapEmployeeSession(row: any): EmployeeSession {
    return {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      tokenJti: row.token_jti,
      ipAddress: row.ip_address,
      riskScore: row.risk_score,
      isActive: row.is_active,
      expiresAt: row.expires_at,
    };
  }
}

export default new DeviceAuthService();
