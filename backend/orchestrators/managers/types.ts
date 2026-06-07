// ══════════════════════════════════════════════════════════════════
// Department Manager & CEO Orchestrator Types
// ══════════════════════════════════════════════════════════════════

import { QueueNames } from '../../utils/queue';

// ─── Department Definitions ───────────────────

export type DepartmentName =
  | 'ai_content'
  | 'seo'
  | 'shopify_publishing'
  | 'data_analytics'
  | 'client_operations'
  | 'infrastructure'
  | 'cost_optimization'
  | 'quality_assurance'
  | 'odoo';

/**
 * Canonical department → queue mapping.
 *
 * This is the AUTHORITATIVE mapping used by the managers.
 * The CeoRoutingTable in CeoRoutingTable.ts has the full
 * routing policies, fallback chains, and job type rules.
 *
 * CORRECTIONS from v1:
 *   - INTERNAL_LINKING moved from QA → SEO (SEO owns linking)
 *   - OBSERVABILITY moved from DataAnalytics → Infrastructure
 *     (observability is infrastructure monitoring, not analytics)
 */
export const DEPARTMENT_QUEUES: Record<DepartmentName, QueueNames[]> = {
  ai_content: [
    QueueNames.CONTENT_GENERATION,
    QueueNames.IMAGE_GENERATION,
    QueueNames.BRAND_VOICE,
    QueueNames.PEXELS_IMAGE,
  ],
  seo: [
    QueueNames.SEO_ANALYSIS,
    QueueNames.SEO_INTELLIGENCE,
    QueueNames.CONTENT_INTELLIGENCE,
    QueueNames.INTERNAL_LINKING,
  ],
  shopify_publishing: [
    QueueNames.SHOPIFY_PUBLISH,
    QueueNames.MULTI_CMS_PUBLISH,
    QueueNames.WEBHOOK_DELIVERY,
  ],
  data_analytics: [
    QueueNames.KEYWORD_RESEARCH,
  ],
  client_operations: [
    QueueNames.CLIENT_SCAN,
    QueueNames.BATCH_CLIENT_SCAN,
    QueueNames.EDITORIAL_WORKFLOW,
  ],
  infrastructure: [
    QueueNames.DEFAULT,
    QueueNames.OBSERVABILITY,
  ],
  cost_optimization: [
    QueueNames.COST_OPTIMIZATION,
  ],
  quality_assurance: [
    QueueNames.FACT_CHECK,
    QueueNames.AI_EVALUATION,
  ],
  odoo: [
    QueueNames.ODOO_SYNC,
    QueueNames.ODOO_BATCH_SYNC,
    QueueNames.ODOO_WEBHOOK,
  ],
};

// ─── Task Types ────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'batch';

export interface DepartmentTask {
  id: string;
  type: string;
  department: DepartmentName;
  priority: TaskPriority;
  payload: Record<string, unknown>;
  clientId?: string;
  userId?: string;
  traceId?: string;
  createdAt: Date;
  deadlineAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  type: string;
  success: boolean;
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
  warnings?: string[];
}

export interface Subtask {
  type: string;
  queueName?: QueueNames;
  payload: Record<string, unknown>;
  dependsOn?: string[]; // subtask type names this depends on
  priority: TaskPriority;
  timeoutMs?: number;
}

export interface DecomposedTask {
  originalTask: DepartmentTask;
  subtasks: Subtask[];
  parallelGroups: string[][]; // groups of subtask types that can run in parallel
}

// ─── Manager Interface ────────────────────────

export interface IDepartmentManager {
  readonly department: DepartmentName;
  readonly name: string;
  readonly description: string;
  readonly managedQueues: QueueNames[];

  /** Initialize the manager with DB pool */
  initialize(pool: any): Promise<void>;

  /** Accept a task, decompose it into subtasks, execute, and aggregate results */
  handleTask(task: DepartmentTask): Promise<TaskResult>;

  /** Decompose a task into its constituent subtasks */
  decompose(task: DepartmentTask): Promise<DecomposedTask>;

  /** Execute a decomposed task: run all subtasks respecting dependency groups */
  execute(task: DepartmentTask, decomposed: DecomposedTask): Promise<TaskResult>;

  /** Get health status of this department */
  getHealth(): Promise<DepartmentHealth>;

  /** Get current metrics for this department */
  getMetrics(): Promise<DepartmentMetrics>;
}

// ─── Health & Metrics ─────────────────────────

export interface DepartmentHealth {
  department: DepartmentName;
  status: 'healthy' | 'degraded' | 'unhealthy';
  workerCount: number;
  activeJobs: number;
  failedJobs24h: number;
  avgLatencyMs: number;
  queueDepths: Record<string, number>;
}

export interface DepartmentMetrics {
  department: DepartmentName;
  tasksProcessed: number;
  tasksFailed: number;
  avgProcessingMs: number;
  throughputPerMin: number;
  queueBacklog: number;
  workerUtilization: number;
}

// ─── CEO Types ─────────────────────────────────

export interface CeoDirective {
  id: string;
  type: string;
  targetDepartment: DepartmentName;
  payload: Record<string, unknown>;
  priority: TaskPriority;
  reason: string;
}

export interface CeoHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  departments: Record<DepartmentName, DepartmentHealth>;
  alerts: CeoAlert[];
  recommendations: string[];
}

export interface CeoAlert {
  severity: 'critical' | 'warning' | 'info';
  department: DepartmentName;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

// ─── Priority mapper ──────────────────────────

export function priorityToNumber(p: TaskPriority): number {
  switch (p) {
    case 'critical': return 0;
    case 'high': return 1;
    case 'normal': return 5;
    case 'low': return 10;
    case 'batch': return 20;
  }
}
