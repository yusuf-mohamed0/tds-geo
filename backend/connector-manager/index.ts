import { logger } from '../utils/logger';
import { eventBus } from '../event-bus';
import { Events } from '../event-bus/events';
import { ConnectorConfig, ConnectorCapability, HealthStatus, ConnectorInterface } from '../sdk/connector-interface';
import { sitesService } from '../services/sitesService';
import { heartbeatService } from '../services/heartbeatService';

interface RegisteredConnector {
  id: string;
  instance: ConnectorInterface;
  config: ConnectorConfig;
  registeredAt: Date;
  lastHealthCheck: Date | null;
  healthy: boolean;
}

export class ConnectorManager {
  private connectors = new Map<string, RegisteredConnector>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  async initialize(pool: any): Promise<void> {
    logger.info('ConnectorManager initialized');
  }

  register(id: string, instance: ConnectorInterface, config: ConnectorConfig): void {
    if (this.connectors.has(id)) {
      logger.warn('ConnectorManager: connector already registered, updating', { id });
    }
    this.connectors.set(id, {
      id,
      instance,
      config,
      registeredAt: new Date(),
      lastHealthCheck: null,
      healthy: true,
    });
    eventBus.emit(Events.CONNECTOR_REGISTERED, { id, provider: instance.provider });
    logger.info('ConnectorManager: registered connector', { id, provider: instance.provider });
  }

  unregister(id: string): void {
    const conn = this.connectors.get(id);
    if (conn) {
      conn.instance.disconnect().catch(() => {});
      this.connectors.delete(id);
      eventBus.emit(Events.CONNECTOR_DISCONNECTED, { id });
    }
  }

  get(id: string): ConnectorInterface | undefined {
    return this.connectors.get(id)?.instance;
  }

  getConfig(id: string): ConnectorConfig | undefined {
    return this.connectors.get(id)?.config;
  }

  getCapabilities(id: string): ConnectorCapability[] {
    return this.connectors.get(id)?.config?.capabilities || [];
  }

  hasCapability(id: string, capability: string): boolean {
    return this.connectors.get(id)?.config?.capabilities?.some(
      c => c.name === capability && c.supported
    ) || false;
  }

  list(): { id: string; provider: string; healthy: boolean; registeredAt: Date }[] {
    return Array.from(this.connectors.entries()).map(([id, c]) => ({
      id,
      provider: c.instance.provider,
      healthy: c.healthy,
      registeredAt: c.registeredAt,
    }));
  }

  async healthCheck(id: string): Promise<HealthStatus | null> {
    const conn = this.connectors.get(id);
    if (!conn) return null;
    try {
      const status = await conn.instance.health();
      conn.healthy = status.status === 'healthy';
      conn.lastHealthCheck = new Date();

      const config = this.getConfig(id);
      if (config?.endpointUrl) {
        try {
          const domain = new URL(config.endpointUrl).hostname;
          await sitesService.updateHealth(domain, id as any, status.status as any);
        } catch { /* non-fatal */ }
      }

      if (!conn.healthy) {
        eventBus.emit(Events.CONNECTOR_HEALTH_CHANGED, { id, status: status.status });
        // Don't trigger heartbeat for stub connectors (webflow, ghost)
        if (!['webflow', 'ghost'].includes(id)) {
          heartbeatService.run().catch(() => {});
        }
      }
      return status;
    } catch {
      conn.healthy = false;
      conn.lastHealthCheck = new Date();

      const config = this.getConfig(id);
      if (config?.endpointUrl) {
        try {
          const domain = new URL(config.endpointUrl).hostname;
          await sitesService.updateHealth(domain, id as any, 'down');
        } catch { /* non-fatal */ }
      }

      eventBus.emit(Events.CONNECTOR_HEALTH_CHANGED, { id, status: 'down' });
      if (!['webflow', 'ghost'].includes(id)) {
        heartbeatService.run().catch(() => {});
      }

      return { status: 'down', version: 'unknown', lastSync: null, uptime: 0, errors: ['Health check failed'] };
    }
  }

  async healthCheckAll(): Promise<void> {
    for (const id of this.connectors.keys()) {
      await this.healthCheck(id);
    }
  }

  startPeriodicHealthChecks(intervalMs = 300000): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.healthCheckInterval = setInterval(() => this.healthCheckAll(), intervalMs);
  }

  stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  count(): number {
    return this.connectors.size;
  }
}

export const connectorManager = new ConnectorManager();
