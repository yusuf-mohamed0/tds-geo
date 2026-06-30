// ══════════════════════════════════════════════════════════════════
// CEO Orchestrator (System Brain)
// Routes tasks to department managers, monitors global health,
// handles prioritization, resolves conflicts, ensures 24/7 operation
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { QueueNames } from '../utils/queue';
import routingTable from './CeoRoutingTable';
import {
  DepartmentName,
  DepartmentTask,
  CeoDirective,
  CeoHealthReport,
  CeoAlert,
  IDepartmentManager,
  TaskResult,
  TaskPriority,
  priorityToNumber,
} from './managers/types';

import AIContentManager from './managers/AIContentManager';
import SeoManager from './managers/SeoManager';
import ShopifyPublishingManager from './managers/ShopifyPublishingManager';
import DataAnalyticsManager from './managers/DataAnalyticsManager';
import ClientOperationsManager from './managers/ClientOperationsManager';
import InfrastructureManager from './managers/InfrastructureManager';
import CostOptimizationManager from './managers/CostOptimizationManager';
import QualityAssuranceManager from './managers/QualityAssuranceManager';
import OdooManager from './managers/OdooManager';

export class CeoOrchestrator {
  private pool: Pool | null = null;
  private managers: Map<DepartmentName, IDepartmentManager> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private activeDirectives: Map<string, CeoDirective> = new Map();
  private lastHealthReport: CeoHealthReport | null = null;

  // ─── Initialization ──────────────────────────

  async initialize(pool: Pool): Promise<void> {
    this.pool = pool;
    logger.info('🏢 CEO Orchestrator initializing...');

    // Register all 8 department managers
    this.registerManager(AIContentManager);
    this.registerManager(SeoManager);
    this.registerManager(ShopifyPublishingManager);
    this.registerManager(DataAnalyticsManager);
    this.registerManager(ClientOperationsManager);
    this.registerManager(InfrastructureManager);
    this.registerManager(CostOptimizationManager);
    this.registerManager(QualityAssuranceManager);
    this.registerManager(OdooManager);

    // Validate routing table coverage at startup
    this.validateRoutingCoverage();

    logger.info('🏢 CEO Orchestrator initialized with 9 department managers');

    // Run health check every 60 seconds
    this.healthCheckInterval = setInterval(() => this.runHealthCheck(), 60_000);

    // Initial health check after 10 seconds
    setTimeout(() => this.runHealthCheck(), 10_000);
  }

  private registerManager(manager: IDepartmentManager): void {
    this.managers.set(manager.department, manager);
    manager.initialize(this.pool!).catch(err => {
      logger.error(`[CEO] Failed to initialize ${manager.name}`, { error: (err as Error).message });
    });
  }

  // ══════════════════════════════════════════════
  // TASK ROUTING
  // ══════════════════════════════════════════════

  /**
   * Route a task to the correct department manager.
   * This is the primary entry point for all work in the system.
   */
  async routeTask(task: DepartmentTask): Promise<TaskResult> {
    const manager = this.managers.get(task.department);
    if (!manager) {
      return {
        taskId: task.id,
        type: task.type,
        success: false,
        durationMs: 0,
        error: `No manager for department: ${task.department}`,
      };
    }

    this.logDirective({
      id: task.id,
      type: task.type,
      targetDepartment: task.department,
      payload: task.payload,
      priority: task.priority,
      reason: `Routing task ${task.type} to ${manager.name}`,
    });

    return manager.handleTask(task);
  }

  /**
   * High-level: create and route a task from scratch.
   */
  async assignTask(
    type: string,
    department: DepartmentName,
    payload: Record<string, unknown>,
    options: {
      clientId?: string;
      userId?: string;
      priority?: TaskPriority;
      traceId?: string;
      deadlineAt?: Date;
    } = {}
  ): Promise<TaskResult> {
    const task: DepartmentTask = {
      id: uuidv4(),
      type,
      department,
      priority: options.priority || 'normal',
      payload,
      clientId: options.clientId,
      userId: options.userId,
      traceId: options.traceId || uuidv4().replace(/-/g, ''),
      createdAt: new Date(),
      deadlineAt: options.deadlineAt,
    };

    return this.routeTask(task);
  }

  // ══════════════════════════════════════════════
  // INTELLIGENT ROUTING
  // ══════════════════════════════════════════════

  /**
   * Route a task to the most appropriate department based on task type.
   * Uses the table-driven CeoRoutingTable for all routing decisions.
   */
  resolveDepartment(type: string, payload?: Record<string, unknown>): DepartmentName {
    return routingTable.resolveDepartment(type, payload);
  }

  /**
   * Smart task routing with load balancing and priority awareness.
   */
  async routeTaskIntelligently(
    type: string,
    payload: Record<string, unknown>,
    options: {
      clientId?: string;
      userId?: string;
      priority?: TaskPriority;
      preferredDepartment?: DepartmentName;
    } = {}
  ): Promise<TaskResult> {
    let department = options.preferredDepartment;

    if (!department) {
      department = this.resolveDepartment(type, payload);
    }

    // Check if preferred department is overloaded
    const manager = this.managers.get(department);
    if (manager) {
      const health = await manager.getHealth();
      if (health.status === 'unhealthy' || health.failedJobs24h > 10) {
        // Try to find a fallback department
        const altDept = this.findFallbackDepartment(type, department);
        if (altDept) {
          logger.warn(`[CEO] ${department} overloaded, routing to ${altDept}`, { type });
          department = altDept;
        }
      }
    }

    return this.assignTask(type, department, payload, {
      ...options,
      priority: options.priority || 'normal',
      traceId: uuidv4().replace(/-/g, ''),
    });
  }

  // ══════════════════════════════════════════════
  // HEALTH MONITORING
  // ══════════════════════════════════════════════

  async runHealthCheck(): Promise<CeoHealthReport> {
    const departmentHealths: Record<string, any> = {};
    const alerts: CeoAlert[] = [];

    for (const [name, manager] of this.managers) {
      try {
        const health = await manager.getHealth();
        departmentHealths[name] = health;

        // Generate alerts for unhealthy departments
        if (health.status === 'unhealthy') {
          alerts.push({
            severity: 'critical',
            department: name,
            message: `${manager.name} is unhealthy — ${health.failedJobs24h} failures in 24h`,
            metric: 'failedJobs24h',
            value: health.failedJobs24h,
            threshold: 10,
          });
        } else if (health.status === 'degraded') {
          alerts.push({
            severity: 'warning',
            department: name,
            message: `${manager.name} is degraded — ${health.failedJobs24h} failures in 24h`,
            metric: 'failedJobs24h',
            value: health.failedJobs24h,
            threshold: 3,
          });
        }
      } catch (err) {
        departmentHealths[name] = { status: 'unhealthy', error: (err as Error).message };
        alerts.push({
          severity: 'critical',
          department: name,
          message: `${manager.name} health check failed: ${(err as Error).message}`,
        });
      }
    }

    const unhealthyCount = Object.values(departmentHealths).filter((h: any) => h.status === 'unhealthy').length;
    const degradedCount = Object.values(departmentHealths).filter((h: any) => h.status === 'degraded').length;

    const overall: 'healthy' | 'degraded' | 'unhealthy' =
      unhealthyCount > 0 ? 'unhealthy' :
      degradedCount > 0 ? 'degraded' : 'healthy';

    // Generate recommendations
    const recommendations = this.generateRecommendations(departmentHealths, alerts);

    this.lastHealthReport = {
      overall,
      departments: departmentHealths as any,
      alerts,
      recommendations,
    };

    logger.info(`[CEO] Health check: ${overall} (${unhealthyCount} unhealthy, ${degradedCount} degraded)`);

    // Auto-resolve: trigger infrastructure manager for critical alerts
    if (alerts.some(a => a.severity === 'critical')) {
      await this.autoResolve(alerts.filter(a => a.severity === 'critical'));
    }

    return this.lastHealthReport;
  }

  async getHealthReport(): Promise<CeoHealthReport> {
    if (this.lastHealthReport) return this.lastHealthReport;
    return this.runHealthCheck();
  }

  // ══════════════════════════════════════════════
  // CONFLICT RESOLUTION
  // ══════════════════════════════════════════════

  /**
   * Resolve conflicts between departments (e.g., competing resource usage).
   */
  async resolveConflict(
    departments: DepartmentName[],
    resource: string,
    priority: TaskPriority
  ): Promise<DepartmentName> {
    if (departments.length === 0) throw new Error('No departments in conflict');
    if (departments.length === 1) return departments[0];

    // Higher priority always wins
    if (priority === 'critical' || priority === 'high') {
      return departments[0]; // First department gets it for critical tasks
    }

    // Otherwise, pick the department with the lowest current load
    const loads = await Promise.all(
      departments.map(async (dept) => {
        const manager = this.managers.get(dept);
        if (!manager) return { dept, load: Infinity };
        const health = await manager.getHealth();
        const totalJobs = Object.values(health.queueDepths).reduce((a, b) => a + b, 0);
        return { dept, load: totalJobs };
      })
    );

    loads.sort((a, b) => a.load - b.load);
    logger.info(`[CEO] Conflict resolved: ${resource} → ${loads[0].dept} (load: ${loads[0].load})`);

    return loads[0].dept;
  }

  // ══════════════════════════════════════════════
  // PUBLIC QUERIES
  // ══════════════════════════════════════════════

  getManager(department: DepartmentName): IDepartmentManager | undefined {
    return this.managers.get(department);
  }

  getAllManagers(): Map<DepartmentName, IDepartmentManager> {
    return new Map(this.managers);
  }

  getManagerList(): Array<{ department: DepartmentName; name: string; description: string }> {
    return Array.from(this.managers.values()).map(m => ({
      department: m.department,
      name: m.name,
      description: m.description,
    }));
  }

  getActiveDirectives(): CeoDirective[] {
    return Array.from(this.activeDirectives.values());
  }

  // ══════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════

  private logDirective(directive: CeoDirective): void {
    this.activeDirectives.set(directive.id, directive);
    logger.info(`[CEO] Directive: ${directive.type} → ${directive.targetDepartment}`, {
      priority: directive.priority,
      reason: directive.reason,
    });
  }

  private findFallbackDepartment(type: string, primary: DepartmentName): DepartmentName | null {
    const chain = routingTable.getFallbackChain(primary);
    if (chain.length > 0) return chain[0];
    return null;
  }

  private generateRecommendations(
    healths: Record<string, any>,
    alerts: CeoAlert[]
  ): string[] {
    const recommendations: string[] = [];

    for (const [dept, health] of Object.entries(healths)) {
      if (health.status === 'unhealthy') {
        recommendations.push(`Investigate ${dept}: ${health.failedJobs24h} job failures in 24h`);
      }
      if (health.avgLatencyMs > 10000) {
        recommendations.push(`Scale ${dept}: avg latency ${health.avgLatencyMs}ms — consider increasing concurrency`);
      }
    }

    if (alerts.length > 0) {
      recommendations.push(`${alerts.length} active alerts — review and resolve`);
    }

    return recommendations;
  }

  private async autoResolve(criticalAlerts: CeoAlert[]): Promise<void> {
    const infraManager = this.managers.get('infrastructure');
    if (!infraManager) return;

    for (const alert of criticalAlerts) {
      // Create a system alert via infrastructure manager
      await infraManager.handleTask({
        id: uuidv4(),
        type: 'create_alert',
        department: 'infrastructure',
        priority: 'critical',
        payload: {
          alertName: `ceo_${alert.department}_critical`,
          severity: 'critical',
          message: alert.message,
          details: { department: alert.department, metric: alert.metric, value: alert.value },
          metricValue: alert.value,
          thresholdValue: alert.threshold,
        },
        createdAt: new Date(),
      });
    }
  }

  // ─── Routing Validation ────────────────────────

  /**
   * Validate routing table coverage on startup.
   * Logs warnings for any missing job type or queue coverage
   * so config drift is caught early.
   */
  private validateRoutingCoverage(): void {
    const missingJobTypes = routingTable.validateJobTypeCoverage();
    if (missingJobTypes.length > 0) {
      logger.warn(`[CEO] Missing job type routing rules: ${missingJobTypes.join(', ')}`);
    }

    const missingQueues = routingTable.validateQueueCoverage();
    if (missingQueues.length > 0) {
      logger.warn(`[CEO] Missing queue routing policies: ${missingQueues.join(', ')}`);
    }

    // Check that all 8 departments have managers registered
    const registeredDepts = new Set(this.managers.keys());
    const allDepts = routingTable.getAllDepartments();
    for (const dept of allDepts) {
      if (!registeredDepts.has(dept)) {
        logger.warn(`[CEO] Department "${dept}" has no manager registered — routing to it will fail`);
      }
    }

    if (missingJobTypes.length === 0 && missingQueues.length === 0) {
      logger.info('[CEO] Routing table coverage: all job types and queues verified');
    }
  }

  /**
   * Resolve a job type string to its routing rule.
   * Uses defensive fallback: tries exact match first, then pattern matching.
   */
  resolveJobType(jobType: string): { department: DepartmentName; queueName: QueueNames } | null {
    // Try exact match from routing table
    const rule = routingTable.resolveJobTypeSafe(jobType);
    if (rule) {
      return { department: rule.primaryDepartment, queueName: rule.primaryQueue };
    }

    // Fallback: pattern-based matching
    const department = routingTable.resolveDepartment(jobType);
    // Look up the first queue for this department
    const queues = routingTable.getQueuesForDepartment(department);
    if (queues.length > 0) {
      logger.warn(`[CEO] No exact routing rule for job type "${jobType}" — resolving via pattern match to ${department}`);
      return { department, queueName: queues[0] };
    }

    // Ultimate fallback
    logger.warn(`[CEO] Could not resolve job type "${jobType}" — defaulting to infrastructure`);
    return { department: 'infrastructure', queueName: QueueNames.DEFAULT };
  }

  // ══════════════════════════════════════════════
  // SHUTDOWN
  // ══════════════════════════════════════════════

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    logger.info('🏢 CEO Orchestrator shut down');
  }
}

// Singleton
export default new CeoOrchestrator();
