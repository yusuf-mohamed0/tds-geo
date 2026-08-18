// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Webhook Delivery Service
// Event-based webhook triggering with retries
// ──────────────────────────────────────────────

import axios from 'axios';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { Webhook } from '../types';
import { decrypt } from './credentialEncryption';
import { redactJsonString } from '../utils/redact';

class WebhookService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Webhook service initialized');
  }

  /**
   * Trigger all active webhooks for a given event.
   */
  async trigger(event: string, clientId: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.pool) return;

    try {
      const result = await this.pool.query(
        `SELECT * FROM webhooks WHERE client_id = $1 AND $2 = ANY(events) AND is_active = true`,
        [clientId, event]
      );

      const webhooks: Webhook[] = result.rows;

      for (const webhook of webhooks) {
        this.deliver(webhook, event, payload).catch(err => {
          logger.error('Webhook delivery failed', { webhookId: webhook.id, error: (err as Error).message });
        });
      }
    } catch (err) {
      logger.error('Failed to trigger webhooks', { event, clientId, error: (err as Error).message });
    }
  }

  private async deliver(webhook: Webhook, event: string, payload: Record<string, unknown>): Promise<void> {
    const deliveryId = await this.recordDelivery(webhook.id, event, payload);

    // Decrypt the stored webhook secret
    let signingSecret: string | undefined;
    if (webhook.secret) {
      try {
        signingSecret = decrypt(webhook.secret);
      } catch {
        logger.error('Failed to decrypt webhook secret', { webhookId: webhook.id });
      }
    }

    for (let attempt = 1; attempt <= webhook.retry_count; attempt++) {
      try {
        const signature = signingSecret
          ? require('crypto').createHmac('sha256', signingSecret).update(JSON.stringify(payload)).digest('hex')
          : undefined;

        const response = await axios.post(webhook.url, {
          event,
          timestamp: new Date().toISOString(),
          data: payload
        }, {
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'X-Webhook-Signature': signature } : {})
          },
          timeout: webhook.timeout_ms || 10000
        });

        await this.updateDeliveryStatus(deliveryId, 'delivered', response.status, '');

        await this.pool!.query(
          'UPDATE webhooks SET last_triggered_at = NOW() WHERE id = $1',
          [webhook.id]
        );

        logger.info('Webhook delivered successfully', { webhookId: webhook.id, event, url: webhook.url });
        return;
      } catch (err) {
        const status = attempt < webhook.retry_count ? 'retrying' : 'failed';
        const errorMsg = (err as any).response?.status
          ? `HTTP ${(err as any).response.status}`
          : (err as Error).message;

        await this.updateDeliveryStatus(deliveryId, status, (err as any).response?.status, errorMsg);

        logger.warn(`Webhook delivery attempt ${attempt}/${webhook.retry_count} failed`, {
          webhookId: webhook.id,
          error: errorMsg
        });

        if (attempt < webhook.retry_count) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
  }

  private async recordDelivery(webhookId: string, event: string, payload: Record<string, unknown>): Promise<string> {
    const result = await this.pool!.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [webhookId, event, redactJsonString(payload)]
    );
    return result.rows[0].id;
  }

  private async updateDeliveryStatus(deliveryId: string, status: string, responseCode?: number, responseBody?: string): Promise<void> {
    await this.pool!.query(
      `UPDATE webhook_deliveries SET status = $1, response_code = $2, response_body = $3, delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE NULL END
       WHERE id = $4`,
      [status, responseCode || null, responseBody || null, deliveryId]
    );
  }
}

export default new WebhookService();
