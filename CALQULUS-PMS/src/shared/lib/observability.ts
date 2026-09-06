/**
 * CALQULUS PMS - Structured Observability Library
 * 
 * Features:
 * - Structured logging with correlation IDs
 * - Business KPI tracking
 * - Application metrics
 * - Web Vitals monitoring
 * - User session tracking
 * - Performance marks
 */

import { supabase } from '@/integrations/supabase/client';
import { captureMessage, captureException } from './sentry';

// ── Types ──────────────────────────────────────────────────────────────
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  correlationId: string;
  userId?: string;
  sessionId: string;
  component: string;
  action: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

export interface BusinessKPI {
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  properties?: {
    property_id?: string;
    manager_id?: string;
    tenant_id?: string;
  };
}

export interface AppMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  lastChecked: string;
}

// ── Correlation ID ────────────────────────────────────────────────────
let correlationIdCounter = 0;

export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (++correlationIdCounter % 1000).toString(36).padStart(3, '0');
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${counter}-${random}`;
}

// ── Session Management ────────────────────────────────────────────────
let currentSessionId: string | null = null;
let currentUserId: string | null = null;

export function setSessionContext(sessionId: string, userId?: string): void {
  currentSessionId = sessionId;
  currentUserId = userId || null;
}

export function clearSessionContext(): void {
  currentSessionId = null;
  currentUserId = null;
}

export function getSessionContext(): { sessionId: string | null; userId: string | null } {
  return { sessionId: currentSessionId, userId: currentUserId };
}

// ── Structured Logger ─────────────────────────────────────────────────
class StructuredLogger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private createEntry(
    level: LogEntry['level'],
    action: string,
    options: {
      duration?: number;
      metadata?: Record<string, unknown>;
      error?: Error | unknown;
    } = {}
  ): LogEntry {
    const { sessionId, userId } = getSessionContext();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: generateCorrelationId(),
      sessionId: sessionId || generateCorrelationId(),
      component: this.component,
      action,
    };

    if (userId) entry.userId = userId;
    if (options.duration !== undefined) entry.duration = options.duration;
    if (options.metadata) entry.metadata = options.metadata;
    if (options.error) {
      const err = options.error instanceof Error ? options.error : new Error(String(options.error));
      entry.error = {
        message: err.message,
        stack: err.stack,
        name: err.name,
      };
    }

    return entry;
  }

  private async log(entry: LogEntry): Promise<void> {
    // Console output in development
    if (import.meta.env.DEV) {
      const prefix = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        critical: '🚨',
      }[entry.level];

      const logFn = entry.level === 'debug' ? console.debug : entry.level === 'warn' ? console.warn : console.error;
      logFn(
        `${prefix} [${entry.component}] ${entry.action}`,
        entry
      );
    }

    // Send to Supabase for audit trail
    try {
      await supabase.rpc('log_activity', {
        p_action: `${entry.level}:${entry.component}:${entry.action}`,
        p_entity_type: 'log',
        p_entity_label: entry.action,
        p_metadata: entry as unknown as Record<string, unknown>,
      });
    } catch {
      // Silently fail - don't block app for logging
    }

    // Send errors to Sentry
    if (entry.level === 'error' || entry.level === 'critical') {
      captureException(entry.error || new Error(entry.action), {
        ...entry.metadata,
        component: entry.component,
        correlationId: entry.correlationId,
        sessionId: entry.sessionId,
      });
    } else if (entry.metadata) {
      captureMessage(`[${entry.component}] ${entry.action}`, {
        ...entry.metadata,
        correlationId: entry.correlationId,
        sessionId: entry.sessionId,
      });
    }
  }

  debug(action: string, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('debug', action, { metadata }));
  }

  info(action: string, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('info', action, { metadata }));
  }

  warn(action: string, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('warn', action, { metadata }));
  }

  error(action: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('error', action, { error, metadata }));
  }

  critical(action: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    this.log(this.createEntry('critical', action, { error, metadata }));
  }

  // Timed operation
  async time<T>(action: string, fn: () => T | Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(action, { duration: Math.round(duration), ...metadata });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(action, error, { duration: Math.round(duration), ...metadata });
      throw error;
    }
  }
}

export function createLogger(component: string): StructuredLogger {
  return new StructuredLogger(component);
}

// ── Application Metrics ──────────────────────────────────────────────
class MetricsCollector {
  private metrics: AppMetric[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.startFlushLoop();
    }
  }

  private startFlushLoop(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  record(metric: Omit<AppMetric, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString(),
    });

    // Auto-flush if batch is full
    if (this.metrics.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.record({ name, value: 1, unit: 'count', tags });
  }

  gauge(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.record({ name, value, unit, tags });
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record({ name, value: durationMs, unit: 'ms', tags });
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const batch = this.metrics.splice(0, this.metrics.length);

    try {
      // Log metrics as structured data
      for (const metric of batch) {
        await supabase.rpc('log_activity', {
          p_action: `metric:${metric.name}`,
          p_entity_type: 'metric',
          p_entity_label: `${metric.name}: ${metric.value}${metric.unit}`,
          p_metadata: metric as unknown as Record<string, unknown>,
        });
      }
    } catch {
      // Silently fail - metrics are non-critical
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const metrics = new MetricsCollector();

// ── Business KPIs ─────────────────────────────────────────────────────
class KPITracker {
  async track(kpi: Omit<BusinessKPI, 'timestamp'>): Promise<void> {
    const entry = {
      ...kpi,
      timestamp: new Date().toISOString(),
    };

    try {
      await supabase.rpc('log_activity', {
        p_action: `kpi:${kpi.name}`,
        p_entity_type: 'kpi',
        p_entity_label: `${kpi.name}: ${kpi.value}${kpi.unit || ''}`,
        p_manager_id: kpi.properties?.manager_id || null,
        p_property_id: kpi.properties?.property_id || null,
        p_metadata: entry as unknown as Record<string, unknown>,
      });

      // Also record as metric
      metrics.record({
        name: `kpi_${kpi.name}`,
        value: kpi.value,
        unit: kpi.unit || 'count',
        tags: kpi.properties as Record<string, string>,
      });
    } catch {
      // Silently fail
    }
  }

  // Payment KPIs
  async trackPayment(paymentId: string, amount: number, status: 'success' | 'failed' | 'pending', managerId?: string): Promise<void> {
    await this.track({
      name: `payment_${status}`,
      value: amount,
      unit: 'KES',
      properties: { manager_id: managerId },
    });
  }

  // Tenant KPIs
  async trackTenantEvent(event: 'signup' | 'lease_signed' | 'move_in' | 'move_out', tenantId?: string, managerId?: string): Promise<void> {
    await this.track({
      name: `tenant_${event}`,
      value: 1,
      unit: 'count',
      properties: { tenant_id: tenantId, manager_id: managerId },
    });
  }

  // Property KPIs
  async trackPropertyEvent(event: 'created' | 'unit_added' | 'unit_occupied', propertyId?: string, managerId?: string): Promise<void> {
    await this.track({
      name: `property_${event}`,
      value: 1,
      unit: 'count',
      properties: { property_id: propertyId, manager_id: managerId },
    });
  }

  // Revenue KPIs
  async trackRevenue(amount: number, source: 'rent' | 'water' | 'other', managerId?: string): Promise<void> {
    await this.track({
      name: `revenue_${source}`,
      value: amount,
      unit: 'KES',
      properties: { manager_id: managerId },
    });
  }
}

export const kpi = new KPITracker();

// ── Web Vitals ────────────────────────────────────────────────────────
export function initWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Largest Contentful Paint (LCP)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEntry & { element?: Element };
    
    metrics.record({
      name: 'webvital_lcp',
      value: lastEntry.startTime,
      unit: 'ms',
      tags: {
        element: lastEntry.element?.tagName.toLowerCase() || 'unknown',
      },
    });

    // Alert if LCP > 2.5s
    if (lastEntry.startTime > 2500) {
      kpi.track({
        name: 'lcp_degraded',
        value: lastEntry.startTime,
        unit: 'ms',
      });
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // First Input Delay (FID)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    for (const entry of entries) {
      metrics.record({
        name: 'webvital_fid',
        value: (entry as PerformanceEntry & { processingStart: number }).processingStart - entry.startTime,
        unit: 'ms',
      });
    }
  }).observe({ type: 'first-input', buffered: true });

  // Cumulative Layout Shift (CLS)
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    for (const entry of entries) {
      if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
        clsValue += (entry as PerformanceEntry & { value: number }).value;
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });

  // Report CLS on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      metrics.record({
        name: 'webvital_cls',
        value: clsValue,
        unit: 'score',
      });
    }
  });

  // Time to First Byte (TTFB)
  new PerformanceObserver(() => {
    const ttfb = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming & { responseStart: number; requestStart: number };
    if (ttfb?.responseStart) {
      metrics.record({
        name: 'webvital_ttfb',
        value: ttfb.responseStart - ttfb.requestStart,
        unit: 'ms',
      });
    }
  }).observe({ type: 'navigation', buffered: true });

  // Interaction to Next Paint (INP) — replaces FID as the responsiveness vital
  try {
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const eventEntry = entry as PerformanceEventTiming;
        metrics.record({
          name: 'webvital_inp',
          value: eventEntry.duration,
          unit: 'ms',
          tags: {
            name: eventEntry.name,
          },
        });
        if (eventEntry.duration > 200) {
          kpi.track({
            name: 'inp_degraded',
            value: eventEntry.duration,
            unit: 'ms',
          });
        }
      }
    });
    inpObserver.observe({
      type: 'event',
      buffered: true,
      durationThreshold: 40,
    } as PerformanceObserverInit);
  } catch {
    // Event Timing API is not available in this browser
  }
}

// ── Health Checks ─────────────────────────────────────────────────────
export async function checkHealth(): Promise<HealthStatus[]> {
  const checks: HealthStatus[] = [];
  const now = new Date().toISOString();

  // Check Supabase
  const supabaseStart = performance.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    checks.push({
      component: 'supabase',
      status: error ? 'degraded' : 'healthy',
      latency: performance.now() - supabaseStart,
      error: error?.message,
      lastChecked: now,
    });
  } catch (e) {
    checks.push({
      component: 'supabase',
      status: 'unhealthy',
      latency: performance.now() - supabaseStart,
      error: String(e),
      lastChecked: now,
    });
  }

  // Check local storage
  try {
    localStorage.setItem('__health_check__', '1');
    localStorage.removeItem('__health_check__');
    checks.push({
      component: 'local_storage',
      status: 'healthy',
      lastChecked: now,
    });
  } catch {
    checks.push({
      component: 'local_storage',
      status: 'degraded',
      error: 'Storage quota exceeded',
      lastChecked: now,
    });
  }

  return checks;
}

// ── Performance Marks ──────────────────────────────────────────────────
export function mark(name: string, metadata?: Record<string, unknown>): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
  metrics.increment(`perf_mark_${name}`);
  createLogger('performance').info(name, metadata);
}

export function measure(name: string, startMark: string, endMark?: string, metadata?: Record<string, unknown>): number | null {
  if (typeof performance === 'undefined' || !performance.measure) return null;

  try {
    const measurement = performance.measure(name, startMark, endMark);
    const duration = measurement.duration;
    
    // timing() tags must be string-valued (they're forwarded to the metrics
    // backend as-is); metadata here is arbitrary, so stringify each value
    // rather than casting past the mismatch.
    const tags = metadata
      ? Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)]))
      : undefined;
    metrics.timing(`perf_measure_${name}`, duration, tags);
    
    return duration;
  } catch {
    return null;
  }
}

// ── User Journey Tracking ───────────────────────────────────────────────
class JourneyTracker {
  private currentJourney: { name: string; steps: { name: string; timestamp: string }[] } | null = null;

  startJourney(name: string): void {
    this.currentJourney = {
      name,
      steps: [{ name: 'start', timestamp: new Date().toISOString() }],
    };
    
    metrics.increment('journey_started', { journey: name });
    createLogger('journey').info(`Journey started: ${name}`);
  }

  step(name: string): void {
    if (!this.currentJourney) {
      console.warn('Journey not started');
      return;
    }

    this.currentJourney.steps.push({
      name,
      timestamp: new Date().toISOString(),
    });

    metrics.increment('journey_step', { 
      journey: this.currentJourney.name, 
      step: name,
    });
  }

  completeJourney(success: boolean, metadata?: Record<string, unknown>): void {
    if (!this.currentJourney) {
      console.warn('Journey not started');
      return;
    }

    const journey = this.currentJourney;
    this.currentJourney = null;

    const duration = new Date(journey.steps[journey.steps.length - 1].timestamp).getTime() -
                     new Date(journey.steps[0].timestamp).getTime();

    metrics.increment(success ? 'journey_completed' : 'journey_abandoned', {
      journey: journey.name,
      steps: journey.steps.length.toString(),
      duration: Math.round(duration / 1000).toString(),
    });

    kpi.track({
      name: success ? `journey_${journey.name}_completed` : `journey_${journey.name}_abandoned`,
      value: journey.steps.length,
      unit: 'steps',
      properties: metadata as Record<string, string>,
    });

    createLogger('journey').info(
      `${success ? 'Journey completed' : 'Journey abandoned'}: ${journey.name}`,
      { steps: journey.steps, duration: Math.round(duration) }
    );
  }

  cancelJourney(): void {
    this.completeJourney(false);
  }
}

export const journey = new JourneyTracker();

// ── Initialize ──────────────────────────────────────────────────────
export function initObservability(): void {
  // Set session context
  const sessionId = generateCorrelationId();
  setSessionContext(sessionId);

  // Initialize Web Vitals
  initWebVitals();

  // Log app start
  createLogger('app').info('Application initialized', {
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  });

  // Track page visibility
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      metrics.flush();
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    metrics.flush();
  });
}
