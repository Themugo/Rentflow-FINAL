/**
 * _shared/errorTracking.ts
 *
 * Error tracking and monitoring for CALQULUS PMS edge functions.
 *
 * Provides centralized error tracking, aggregation, and reporting
 * for production monitoring and alerting.
 *
 * Usage:
 *   import { trackError, getErrorStats, createErrorReport } from "../_shared/errorTracking.ts";
 *
 *   try {
 *     // ... code that might fail
 *   } catch (error) {
 *     trackError(error, { context: "payment-processing", userId: "123" });
 *   }
 */

export interface ErrorContext {
  userId?: string;
  function?: string;
  operation?: string;
  correlationId?: string;
  traceId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface ErrorEvent {
  id: string;
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack?: string;
  };
  context: ErrorContext;
  severity: "low" | "medium" | "high" | "critical";
  resolved: boolean;
  occurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByFunction: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByType: Record<string, number>;
  recentErrors: ErrorEvent[];
  topErrors: Array<{
    error: string;
    count: number;
    lastSeen: string;
  }>;
}

// In-memory error storage (in production, this would be a database)
const errorStore = new Map<string, ErrorEvent>();
const errorAggregation = new Map<string, { count: number; lastSeen: string }>();

/**
 * Generate a unique error ID
 */
function generateErrorId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a fingerprint for error deduplication
 */
function generateErrorFingerprint(error: Error, context: ErrorContext): string {
  const key = `${error.name}:${error.message}:${context.function || 'unknown'}:${context.operation || 'unknown'}`;
  return btoa(key).substring(0, 32);
}

/**
 * Determine error severity based on error type and context
 */
function determineSeverity(error: Error, context: ErrorContext): "low" | "medium" | "high" | "critical" {
  // Critical errors that should trigger immediate alerts
  if (error.name === "TypeError" && error.message.includes("Cannot read")) {
    return "critical";
  }
  
  if (error.name === "ReferenceError") {
    return "critical";
  }
  
  if (context.operation === "payment-processing" || context.operation === "payment-initiation") {
    return "high";
  }
  
  if (error.message.includes("timeout") || error.message.includes("deadline")) {
    return "high";
  }
  
  if (error.message.includes("network") || error.message.includes("connection")) {
    return "medium";
  }
  
  return "low";
}

/**
 * Track an error event
 */
export function trackError(error: Error, context: ErrorContext = {}): string {
  const errorId = generateErrorId();
  const fingerprint = generateErrorFingerprint(error, context);
  const severity = determineSeverity(error, context);
  const timestamp = new Date().toISOString();
  
  const errorEvent: ErrorEvent = {
    id: errorId,
    timestamp,
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
    },
    context,
    severity,
    resolved: false,
    occurrenceCount: 1,
    firstSeen: timestamp,
    lastSeen: timestamp,
  };
  
  // Check if this error has been seen before
  const existing = errorAggregation.get(fingerprint);
  if (existing) {
    existing.count++;
    existing.lastSeen = timestamp;
    errorEvent.occurrenceCount = existing.count;
    errorEvent.firstSeen = timestamp; // Would be actual first seen in production
    errorEvent.lastSeen = existing.lastSeen;
  } else {
    errorAggregation.set(fingerprint, {
      count: 1,
      lastSeen: timestamp,
    });
  }
  
  errorStore.set(errorId, errorEvent);
  
  // Log the error for immediate visibility
  console.error(`[ERROR_TRACKING] ${severity.toUpperCase()}: ${error.message}`, {
    errorId,
    fingerprint,
    context,
    occurrenceCount: errorEvent.occurrenceCount,
  });
  
  return errorId;
}

/**
 * Get error statistics
 */
export function getErrorStats(timeRange?: { start: Date; end: Date }): ErrorStats {
  const allErrors = Array.from(errorStore.values());
  
  let filteredErrors = allErrors;
  if (timeRange) {
    filteredErrors = allErrors.filter(error => {
      const errorTime = new Date(error.timestamp);
      return errorTime >= timeRange.start && errorTime <= timeRange.end;
    });
  }
  
  const errorsByFunction: Record<string, number> = {};
  const errorsBySeverity: Record<string, number> = {};
  const errorsByType: Record<string, number> = {};
  
  filteredErrors.forEach(error => {
    const func = error.context.function || "unknown";
    errorsByFunction[func] = (errorsByFunction[func] || 0) + 1;
    
    errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    
    const errorType = error.error.name || "unknown";
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
  });
  
  // Get top errors by occurrence
  const topErrors = Array.from(errorAggregation.entries())
    .map(([fingerprint, data]) => ({
      error: fingerprint,
      count: data.count,
      lastSeen: data.lastSeen,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalErrors: filteredErrors.length,
    errorsByFunction,
    errorsBySeverity,
    errorsByType,
    recentErrors: filteredErrors.slice(-20),
    topErrors,
  };
}

/**
 * Get a specific error by ID
 */
export function getError(errorId: string): ErrorEvent | undefined {
  return errorStore.get(errorId);
}

/**
 * Mark an error as resolved
 */
export function resolveError(errorId: string): boolean {
  const error = errorStore.get(errorId);
  if (error) {
    error.resolved = true;
    return true;
  }
  return false;
}

/**
 * Create an error report for a specific time period
 */
export function createErrorReport(timeRange: { start: Date; end: Date }): {
  summary: string;
  stats: ErrorStats;
  criticalErrors: ErrorEvent[];
  recommendations: string[];
} {
  const stats = getErrorStats(timeRange);
  const criticalErrors = Array.from(errorStore.values())
    .filter(error => 
      error.severity === "critical" && 
      new Date(error.timestamp) >= timeRange.start &&
      new Date(error.timestamp) <= timeRange.end
    );
  
  const recommendations: string[] = [];
  
  // Generate recommendations based on error patterns
  if (stats.errorsBySeverity.critical > 0) {
    recommendations.push("Immediate attention required: Critical errors detected");
  }
  
  if (stats.errorsBySeverity.high > 10) {
    recommendations.push("High error rate detected: Review error patterns and implement fixes");
  }
  
  if (stats.errorsByFunction["initiate-mpesa-payment"] > 5) {
    recommendations.push("M-Pesa payment initiation errors: Check Paystack API status and configuration");
  }
  
  if (stats.errorsByType["TypeError"] > 10) {
    recommendations.push("TypeScript type errors: Review code for null/undefined handling");
  }
  
  const totalErrors = stats.totalErrors;
  const summary = `Error Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${totalErrors} errors detected`;
  
  return {
    summary,
    stats,
    criticalErrors,
    recommendations,
  };
}

/**
 * Clear old errors (for memory management)
 */
export function clearOldErrors(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;
  
  for (const [id, error] of errorStore.entries()) {
    if (new Date(error.timestamp) < cutoff) {
      errorStore.delete(id);
      cleared++;
    }
  }
  
  return cleared;
}

/**
 * Wrap a function with automatic error tracking
 */
export function withErrorTracking<T extends (...args: any[]) => any>(
  fn: T,
  context: ErrorContext
): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        trackError(error, context);
      }
      throw error;
    }
  }) as T;
}

/**
 * Wrap an async function with automatic error tracking
 */
export function withAsyncErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        trackError(error, context);
      }
      throw error;
    }
  }) as T;
}

/**
 * Get error rate per function
 */
export function getErrorRateByFunction(): Record<string, { rate: number; count: number }> {
  const stats = getErrorStats();
  const rates: Record<string, { rate: number; count: number }> = {};
  
  // In production, this would calculate rate based on total requests
  // For now, just return counts
  Object.entries(stats.errorsByFunction).forEach(([func, count]) => {
    rates[func] = {
      rate: count, // Would be count / total_requests in production
      count,
    };
  });
  
  return rates;
}
