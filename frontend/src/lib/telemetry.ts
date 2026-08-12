import { isEmbedded } from './embedded';

// ══════════════════════════════════════════════
// Kivo Telemetry — tiny browser beacon
// Batches events and posts them to /api/telemetry
// on an interval and on page unload via sendBeacon.
// Captures: page views, unhandled errors/rejections,
// and the tds:frontend-error CustomEvent emitted by
// ErrorBoundary. Lightweight and non-blocking.
// ══════════════════════════════════════════════

interface TelemetryEvent {
  surface: 'web' | 'shopify' | 'api' | 'worker' | 'connector' | 'system';
  actorType?: string;
  actorId?: string | null;
  clientId?: string | null;
  action: string;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  success?: boolean;
  durationMs?: number | null;
  shop?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

const QUEUE_KEY = 'snf_telemetry_queue';
const BATCH_LIMIT = 50;
const MAX_QUEUE = 500;
const FLUSH_INTERVAL_MS = 8000;

let shopDomain: string | null = null;

function getShop(): string | null {
  if (shopDomain) return shopDomain;
  try {
    const url = new URL(window.location.href);
    const s = url.searchParams.get('shop');
    if (s) shopDomain = s;
  } catch {
    /* ignore */
  }
  return shopDomain;
}

function loadQueue(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistQueue(events: TelemetryEvent[]): void {
  try {
    const trimmed = events.slice(-MAX_QUEUE);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full — drop rather than break the app */
  }
}

let pending: TelemetryEvent[] = [];

export function track(
  action: string,
  opts: Omit<TelemetryEvent, 'action' | 'surface'> = {}
): void {
  const ev: TelemetryEvent = {
    surface: isEmbedded() ? 'shopify' : 'web',
    action,
    shop: getShop(),
    ...opts,
  };
  pending.push(ev);
  if (pending.length >= BATCH_LIMIT) {
    void flush();
  }
}

function flushViaFetch(events: TelemetryEvent[]): void {
  const body = JSON.stringify({ events });
  try {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // network failed mid-flight — restore to queue for next/reload
      const q = loadQueue();
      q.push(...events);
      persistQueue(q);
    });
  } catch {
    // keepalive unsupported → restore to queue
    const q = loadQueue();
    q.push(...events);
    persistQueue(q);
  }
}

export function flush(): void {
  if (pending.length === 0) return;
  // Drain the in-memory batch first, then replay any persisted queue.
  const batch = pending;
  pending = [];
  void flushViaFetch(batch);

  const queued = loadQueue();
  if (queued.length > 0) {
    persistQueue([]);
    void flushViaFetch(queued);
  }
}

function drainQueueOnLoad(): void {
  const queued = loadQueue();
  if (queued.length > 0) {
    persistQueue([]);
    void flushViaFetch(queued);
  }
}

function installGlobalHandlers(): void {
  window.addEventListener('error', (event: ErrorEvent) => {
    track('frontend.error', {
      errorType: 'pageerror',
      errorMessage: `${event.message} @ ${event.filename}:${event.lineno}`,
      metadata: { col: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection';
    track('frontend.unhandledrejection', {
      errorType: 'unhandledrejection',
      errorMessage: message.slice(0, 4000),
    });
  });

  window.addEventListener('tds:frontend-error', ((e: CustomEvent) => {
    const { error } = e.detail || {};
    track('frontend.component-error', {
      errorType: 'componenterror',
      errorMessage: (error?.message || 'Component error').slice(0, 4000),
      metadata: { stack: error?.stack?.slice(0, 2000) },
    });
  }) as EventListener);

  window.addEventListener('pagehide', () => flush());
  window.addEventListener('beforeunload', () => flush());

  drainQueueOnLoad();
}

export function initTelemetry(): void {
  if (import.meta.env.MODE === 'test') return;
  installGlobalHandlers();
  setInterval(() => flush(), FLUSH_INTERVAL_MS);
}

export default { init: initTelemetry, track, flush };
