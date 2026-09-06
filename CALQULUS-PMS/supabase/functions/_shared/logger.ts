/**
 * _shared/logger.ts
 *
 * Structured logging for CALQULUS PMS edge functions with observability.
 *
 * Provides consistent logging across all functions with
 * proper formatting, levels, context, correlation IDs, and distributed tracing.
 *
 * Usage:
 *   import { createLogger, getCorrelationId } from "../_shared/logger.ts";
 *
 *   const logger = createLogger("payment-function");
 *   logger.info("Payment processed", { paymentId: "123", amount: 5000 });
 *   logger.error("Payment failed", { error: "Insufficient funds", paymentId: "123" });
 *   
 *   // Get correlation ID for distributed tracing
 *   const correlationId = getCorrelationId();
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogContext {
  [key: string]: any;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  function?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
}

// Global correlation ID storage for distributed tracing
let globalCorrelationId: string | null = null;
let globalTraceId: string | null = null;
let globalSpanId: string | null = null;

/**
 * Generate or get the current correlation ID
 */
export function getCorrelationId(): string {
  if (!globalCorrelationId) {
    globalCorrelationId = crypto.randomUUID();
  }
  return globalCorrelationId;
}

/**
 * Set the correlation ID (useful when receiving from upstream service)
 */
export function setCorrelationId(correlationId: string): void {
  globalCorrelationId = correlationId;
}

/**
 * Get or generate trace ID for distributed tracing
 */
export function getTraceId(): string {
  if (!globalTraceId) {
    globalTraceId = crypto.randomUUID();
  }
  return globalTraceId;
}

/**
 * Set the trace ID
 */
export function setTraceId(traceId: string): void {
  globalTraceId = traceId;
}

/**
 * Get or generate span ID for distributed tracing
 */
export function getSpanId(): string {
  if (!globalSpanId) {
    globalSpanId = crypto.randomUUID();
  }
  return globalSpanId;
}

/**
 * Set the span ID
 */
export function setSpanId(spanId: string): void {
  globalSpanId = spanId;
}

/**
 * Extract correlation ID from request headers
 */
export function extractCorrelationId(req: Request): string {
  const correlationId = req.headers.get("X-Correlation-ID") || 
                        req.headers.get("x-correlation-id") ||
                        req.headers.get("X-Request-ID") ||
                        req.headers.get("x-request-id");
  
  if (correlationId) {
    setCorrelationId(correlationId);
  }
  
  return getCorrelationId();
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(req: Request): { traceId: string; spanId: string } {
  const traceId = req.headers.get("X-Trace-ID") || 
                   req.headers.get("x-trace-id") ||
                   req.headers.get("traceparent")?.split("-")[0];
  
  const spanId = req.headers.get("X-Span-ID") || 
                 req.headers.get("x-span-id") ||
                 req.headers.get("traceparent")?.split("-")[1];
  
  if (traceId) setTraceId(traceId);
  if (spanId) setSpanId(spanId);
  
  return {
    traceId: getTraceId(),
    spanId: getSpanId(),
  };
}

class Logger {
  private functionName: string;
  private staticContext: LogContext;

  constructor(functionName: string = "unknown", staticContext: LogContext = {}) {
    this.functionName = functionName;
    this.staticContext = staticContext;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const correlationId = getCorrelationId();
    const traceId = getTraceId();
    const spanId = getSpanId();
    
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    const traceStr = correlationId ? ` [correlation:${correlationId}]` : "";
    const traceIdStr = traceId ? ` [trace:${traceId}]` : "";
    const spanIdStr = spanId ? ` [span:${spanId}]` : "";
    
    return `[${timestamp}] [${level}] [${this.functionName}]${traceStr}${traceIdStr}${spanIdStr} ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const mergedContext = {
      ...this.staticContext,
      correlationId: getCorrelationId(),
      traceId: getTraceId(),
      spanId: getSpanId(),
      ...context,
    };
    
    const formatted = this.formatMessage(level, message, mergedContext);
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Create a child logger with additional context.
   */
  child(additionalContext: LogContext): Logger {
    const mergedContext = { ...this.staticContext, ...additionalContext };
    return new Logger(this.functionName, mergedContext);
  }

  /**
   * Log with performance timing
   */
  withTiming<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    this.debug(`Starting ${operation}`);
    
    return fn().then(result => {
      const duration = performance.now() - startTime;
      this.info(`Completed ${operation}`, { duration: `${duration.toFixed(2)}ms` });
      return result;
    }).catch(error => {
      const duration = performance.now() - startTime;
      this.error(`Failed ${operation}`, { 
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    });
  }
}

/**
 * Create a logger instance for a specific function.
 */
export function createLogger(functionName: string, staticContext?: LogContext): Logger {
  return new Logger(functionName, staticContext);
}

/**
 * Default logger instance (use when function name is not important).
 */
export const logger = new Logger("edge-function");
