/**
 * _shared/tracing.ts
 *
 * Distributed tracing for CALQULUS PMS edge functions.
 *
 * Provides OpenTelemetry-compatible distributed tracing capabilities
 * for tracking requests across services and functions.
 *
 * Usage:
 *   import { createTracer, startSpan, injectTraceContext } from "../_shared/tracing.ts";
 *
 *   const tracer = createTracer("payment-service");
 *   const span = startSpan(tracer, "process-payment");
 *   // ... do work ...
 *   span.end();
 */

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled?: boolean;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "ok" | "error";
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; level: string; message: string; fields?: Record<string, any> }>;
}

export interface Tracer {
  serviceName: string;
  activeSpans: Map<string, Span>;
}

// Global tracer instance
let globalTracer: Tracer | null = null;

/**
 * Create or get the global tracer instance
 */
export function createTracer(serviceName: string): Tracer {
  if (!globalTracer) {
    globalTracer = {
      serviceName,
      activeSpans: new Map(),
    };
  }
  return globalTracer;
}

/**
 * Get the current tracer instance
 */
export function getTracer(): Tracer | null {
  return globalTracer;
}

/**
 * Generate a random span ID (8 bytes hex)
 */
function generateSpanId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random trace ID (16 bytes hex)
 */
function generateTraceId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Start a new span for distributed tracing
 */
export function startSpan(
  tracer: Tracer,
  operationName: string,
  parentSpanId?: string,
  traceId?: string
): Span {
  const span: Span = {
    traceId: traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId,
    operationName,
    startTime: performance.now(),
    status: "ok",
    tags: {
      "service.name": tracer.serviceName,
      "span.kind": "server",
    },
    logs: [],
  };

  tracer.activeSpans.set(span.spanId, span);
  
  // Set global trace context
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__traceId = span.traceId;
    (globalThis as any).__spanId = span.spanId;
  }

  return span;
}

/**
 * End a span and record its duration
 */
export function endSpan(span: Span, status: "ok" | "error" = "ok"): Span {
  span.endTime = performance.now();
  span.duration = span.endTime - span.startTime;
  span.status = status;

  const tracer = getTracer();
  if (tracer) {
    tracer.activeSpans.delete(span.spanId);
  }

  return span;
}

/**
 * Add a tag to a span
 */
export function addTag(span: Span, key: string, value: string | number | boolean): void {
  span.tags[key] = value;
}

/**
 * Add multiple tags to a span
 */
export function addTags(span: Span, tags: Record<string, string | number | boolean>): void {
  Object.assign(span.tags, tags);
}

/**
 * Log an event to a span
 */
export function logEvent(
  span: Span,
  level: string,
  message: string,
  fields?: Record<string, any>
): void {
  span.logs.push({
    timestamp: performance.now(),
    level,
    message,
    fields,
  });
}

/**
 * Record an error in a span
 */
export function recordError(span: Span, error: Error): void {
  span.status = "error";
  addTag(span, "error", true);
  addTag(span, "error.message", error.message);
  addTag(span, "error.type", error.name);
  
  logEvent(span, "error", error.message, {
    stack: error.stack,
  });
}

/**
 * Inject trace context into HTTP headers
 */
export function injectTraceContext(span: Span, headers: Headers): void {
  headers.set("X-Trace-ID", span.traceId);
  headers.set("X-Span-ID", span.spanId);
  if (span.parentSpanId) {
    headers.set("X-Parent-Span-ID", span.parentSpanId);
  }
  
  // W3C traceparent format: version-traceid-spanid-traceflags
  const traceFlags = "01"; // sampled
  headers.set("traceparent", `00-${span.traceId}-${span.spanId}-${traceFlags}`);
}

/**
 * Extract trace context from HTTP headers
 */
export function extractTraceContext(headers: Headers): SpanContext | null {
  const traceId = headers.get("X-Trace-ID") || 
                 headers.get("x-trace-id") ||
                 headers.get("traceparent")?.split("-")[1];
  
  const spanId = headers.get("X-Span-ID") || 
                headers.get("x-span-id") ||
                headers.get("traceparent")?.split("-")[2];
  
  const parentSpanId = headers.get("X-Parent-Span-ID") || 
                      headers.get("x-parent-span-id");

  if (!traceId || !spanId) {
    return null;
  }

  return {
    traceId,
    spanId,
    parentSpanId: parentSpanId || undefined,
  };
}

/**
 * Create a child span from a parent span
 */
export function createChildSpan(
  tracer: Tracer,
  parentSpan: Span,
  operationName: string
): Span {
  return startSpan(tracer, operationName, parentSpan.spanId, parentSpan.traceId);
}

/**
 * Get all active spans for a trace
 */
export function getActiveSpansForTrace(traceId: string): Span[] {
  const tracer = getTracer();
  if (!tracer) return [];

  return Array.from(tracer.activeSpans.values()).filter(
    span => span.traceId === traceId
  );
}

/**
 * Wrap a function with automatic tracing
 */
export async function withSpan<T>(
  tracer: Tracer,
  operationName: string,
  fn: (span: Span) => Promise<T>,
  parentSpanId?: string,
  traceId?: string
): Promise<T> {
  const span = startSpan(tracer, operationName, parentSpanId, traceId);
  
  try {
    const result = await fn(span);
    endSpan(span, "ok");
    return result;
  } catch (error) {
    if (error instanceof Error) {
      recordError(span, error);
    }
    endSpan(span, "error");
    throw error;
  }
}

/**
 * Export span data for external monitoring systems
 */
export function exportSpan(span: Span): Record<string, any> {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    operationName: span.operationName,
    startTime: span.startTime,
    endTime: span.endTime,
    duration: span.duration,
    status: span.status,
    tags: span.tags,
    logs: span.logs,
  };
}

/**
 * Export all active spans for external monitoring
 */
export function exportActiveSpans(): Record<string, any>[] {
  const tracer = getTracer();
  if (!tracer) return [];

  return Array.from(tracer.activeSpans.values()).map(exportSpan);
}
