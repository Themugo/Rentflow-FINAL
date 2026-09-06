/**
 * _shared/functionMonitoring.ts
 *
 * Edge function monitoring and failure tracking for CALQULUS PMS.
 *
 * Provides comprehensive edge function monitoring including execution time,
 * success rates, memory usage, and failure patterns.
 *
 * Usage:
 *   import { trackFunctionExecution, getFunctionStats, createFunctionReport } from "../_shared/functionMonitoring.ts";
 *
 *   trackFunctionExecution("initiate-mpesa-payment", 150, true, { userId: "123" });
 *   const stats = getFunctionStats();
 */

export interface FunctionExecutionEvent {
  id: string;
  timestamp: string;
  functionName: string;
  duration: number;
  success: boolean;
  statusCode?: number;
  memoryUsed?: number;
  cpuTime?: number;
  correlationId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface FunctionStats {
  totalExecutions: number;
  successRate: number;
  failureRate: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  executionsByFunction: Record<string, number>;
  executionsByStatus: Record<string, number>;
  recentExecutions: FunctionExecutionEvent[];
  slowFunctions: Array<{ functionName: string; avgDuration: number; count: number }>;
  failingFunctions: Array<{ functionName: string; failureRate: number; count: number }>;
  averageMemoryUsed: number;
  averageCpuTime: number;
}

// In-memory function execution storage (in production, this would be a time-series database)
const functionExecutionStore = new Map<string, FunctionExecutionEvent[]>();

/**
 * Generate a unique execution ID
 */
function generateExecutionId(): string {
  return crypto.randomUUID();
}

/**
 * Track a function execution
 */
export function trackFunctionExecution(
  functionName: string,
  duration: number,
  success: boolean,
  metadata: {
    statusCode?: number;
    memoryUsed?: number;
    cpuTime?: number;
    correlationId?: string;
    error?: string;
    [key: string]: any;
  } = {}
): string {
  const executionId = generateExecutionId();
  const timestamp = new Date().toISOString();

  const executionEvent: FunctionExecutionEvent = {
    id: executionId,
    timestamp,
    functionName,
    duration,
    success,
    statusCode: metadata.statusCode,
    memoryUsed: metadata.memoryUsed,
    cpuTime: metadata.cpuTime,
    correlationId: metadata.correlationId,
    error: metadata.error,
    metadata,
  };

  const functionKey = functionName;
  if (!functionExecutionStore.has(functionKey)) {
    functionExecutionStore.set(functionKey, []);
  }

  const executions = functionExecutionStore.get(functionKey)!;
  executions.push(executionEvent);

  // Keep only last 1000 executions per function
  if (executions.length > 1000) {
    executions.shift();
  }

  // Log slow executions (> 3 seconds)
  if (duration > 3000) {
    console.warn(`[FUNCTION_MONITORING] Slow function execution: ${functionName} took ${duration}ms`, {
      executionId,
      functionName,
      duration,
      correlationId: metadata.correlationId,
    });
  }

  // Log failed executions
  if (!success) {
    console.error(`[FUNCTION_MONITORING] Failed function execution: ${functionName}`, {
      executionId,
      functionName,
      duration,
      statusCode: metadata.statusCode,
      error: metadata.error,
      correlationId: metadata.correlationId,
    });
  }

  return executionId;
}

/**
 * Get function statistics
 */
export function getFunctionStats(timeRange?: { start: Date; end: Date }): FunctionStats {
  const allExecutions: FunctionExecutionEvent[] = [];

  for (const executions of functionExecutionStore.values()) {
    allExecutions.push(...executions);
  }

  let filteredExecutions = allExecutions;
  if (timeRange) {
    filteredExecutions = allExecutions.filter(exec => {
      const execTime = new Date(exec.timestamp);
      return execTime >= timeRange.start && execTime <= timeRange.end;
    });
  }

  const totalExecutions = filteredExecutions.length;
  const successCount = filteredExecutions.filter(e => e.success).length;
  const failureCount = filteredExecutions.filter(e => !e.success).length;

  const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
  const failureRate = totalExecutions > 0 ? (failureCount / totalExecutions) * 100 : 0;

  // Calculate duration percentiles
  const durations = filteredExecutions.map(e => e.duration).sort((a, b) => a - b);
  const averageDuration = durations.length > 0 
    ? durations.reduce((sum, dur) => sum + dur, 0) / durations.length 
    : 0;

  const p50Index = Math.floor(durations.length * 0.5);
  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  const p50Duration = durations[p50Index] || 0;
  const p95Duration = durations[p95Index] || 0;
  const p99Duration = durations[p99Index] || 0;

  // Group by function
  const executionsByFunction: Record<string, number> = {};
  filteredExecutions.forEach(exec => {
    executionsByFunction[exec.functionName] = (executionsByFunction[exec.functionName] || 0) + 1;
  });

  // Group by status code
  const executionsByStatus: Record<string, number> = {};
  filteredExecutions.forEach(exec => {
    const status = exec.statusCode?.toString() || (exec.success ? "200" : "500");
    executionsByStatus[status] = (executionsByStatus[status] || 0) + 1;
  });

  // Get recent executions
  const recentExecutions = filteredExecutions.slice(-20);

  // Get slow functions (avg duration > 2 seconds)
  const functionDurations = new Map<string, { total: number; count: number }>();
  filteredExecutions.forEach(exec => {
    if (!functionDurations.has(exec.functionName)) {
      functionDurations.set(exec.functionName, { total: 0, count: 0 });
    }
    const data = functionDurations.get(exec.functionName)!;
    data.total += exec.duration;
    data.count++;
  });

  const slowFunctions = Array.from(functionDurations.entries())
    .map(([functionName, data]) => ({
      functionName,
      avgDuration: data.total / data.count,
      count: data.count,
    }))
    .filter(f => f.avgDuration > 2000)
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10);

  // Get failing functions (failure rate > 10%)
  const functionFailures = new Map<string, { failures: number; total: number }>();
  filteredExecutions.forEach(exec => {
    if (!functionFailures.has(exec.functionName)) {
      functionFailures.set(exec.functionName, { failures: 0, total: 0 });
    }
    const data = functionFailures.get(exec.functionName)!;
    data.total++;
    if (!exec.success) {
      data.failures++;
    }
  });

  const failingFunctions = Array.from(functionFailures.entries())
    .map(([functionName, data]) => ({
      functionName,
      failureRate: (data.failures / data.total) * 100,
      count: data.total,
    }))
    .filter(f => f.failureRate > 10)
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 10);

  // Calculate average memory and CPU usage
  const executionsWithMemory = filteredExecutions.filter(e => e.memoryUsed !== undefined);
  const averageMemoryUsed = executionsWithMemory.length > 0
    ? executionsWithMemory.reduce((sum, e) => sum + (e.memoryUsed || 0), 0) / executionsWithMemory.length
    : 0;

  const executionsWithCpu = filteredExecutions.filter(e => e.cpuTime !== undefined);
  const averageCpuTime = executionsWithCpu.length > 0
    ? executionsWithCpu.reduce((sum, e) => sum + (e.cpuTime || 0), 0) / executionsWithCpu.length
    : 0;

  return {
    totalExecutions,
    successRate,
    failureRate,
    averageDuration,
    p50Duration,
    p95Duration,
    p99Duration,
    executionsByFunction,
    executionsByStatus,
    recentExecutions,
    slowFunctions,
    failingFunctions,
    averageMemoryUsed,
    averageCpuTime,
  };
}

/**
 * Get function statistics for a specific function
 */
export function getFunctionStatsByName(functionName: string, timeRange?: { start: Date; end: Date }): {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  failureRate: number;
  averageMemoryUsed: number;
  recentExecutions: FunctionExecutionEvent[];
} {
  const functionExecutions = functionExecutionStore.get(functionName) || [];
  
  let filteredExecutions = functionExecutions;
  if (timeRange) {
    filteredExecutions = functionExecutions.filter(exec => {
      const execTime = new Date(exec.timestamp);
      return execTime >= timeRange.start && execTime <= timeRange.end;
    });
  }

  const totalExecutions = filteredExecutions.length;
  const successCount = filteredExecutions.filter(e => e.success).length;
  const failureCount = filteredExecutions.filter(e => !e.success).length;

  const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
  const failureRate = totalExecutions > 0 ? (failureCount / totalExecutions) * 100 : 0;

  const averageDuration = filteredExecutions.length > 0
    ? filteredExecutions.reduce((sum, exec) => sum + exec.duration, 0) / filteredExecutions.length
    : 0;

  const executionsWithMemory = filteredExecutions.filter(e => e.memoryUsed !== undefined);
  const averageMemoryUsed = executionsWithMemory.length > 0
    ? executionsWithMemory.reduce((sum, e) => sum + (e.memoryUsed || 0), 0) / executionsWithMemory.length
    : 0;

  return {
    totalExecutions,
    successRate,
    averageDuration,
    failureRate,
    averageMemoryUsed,
    recentExecutions: filteredExecutions.slice(-10),
  };
}

/**
 * Create a function monitoring report
 */
export function createFunctionReport(timeRange: { start: Date; end: Date }): {
  summary: string;
  stats: FunctionStats;
  functionStats: Record<string, ReturnType<typeof getFunctionStatsByName>>;
  recommendations: string[];
} {
  const stats = getFunctionStats(timeRange);
  const functionStats: Record<string, ReturnType<typeof getFunctionStatsByName>> = {};
  const recommendations: string[] = [];

  // Get stats for each function
  for (const functionName of functionExecutionStore.keys()) {
    functionStats[functionName] = getFunctionStatsByName(functionName, timeRange);
  }

  // Generate recommendations
  if (stats.successRate < 95) {
    recommendations.push("Low function success rate detected: Review failing functions and fix issues");
  }

  if (stats.averageDuration > 2000) {
    recommendations.push("High average function duration: Review slow functions and optimize performance");
  }

  if (stats.p95Duration > 5000) {
    recommendations.push("High P95 duration: Some function executions are taking too long, investigate outliers");
  }

  if (stats.slowFunctions.length > 0) {
    recommendations.push(`Slow functions detected: ${stats.slowFunctions.map(f => f.functionName).join(", ")}`);
  }

  if (stats.failingFunctions.length > 0) {
    recommendations.push(`Failing functions detected: ${stats.failingFunctions.map(f => f.functionName).join(", ")}`);
  }

  if (stats.averageMemoryUsed > 100) {
    recommendations.push("High average memory usage: Review memory-intensive functions and optimize");
  }

  // Function-specific recommendations
  if (functionStats["initiate-mpesa-payment"] && functionStats["initiate-mpesa-payment"].failureRate > 5) {
    recommendations.push("initiate-mpesa-payment failures: Review Paystack API integration and error handling");
  }

  if (functionStats["send-tenant-invitation"] && functionStats["send-tenant-invitation"].averageDuration > 3000) {
    recommendations.push("send-tenant-invitation slow: Review email/SMS/WhatsApp sending logic and implement batching");
  }

  const summary = `Function Monitoring Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${stats.totalExecutions} executions, ${stats.successRate.toFixed(1)}% success rate, ${stats.averageDuration.toFixed(0)}ms avg duration`;

  return {
    summary,
    stats,
    functionStats,
    recommendations,
  };
}

/**
 * Clear old function executions (for memory management)
 */
export function clearOldFunctionExecutions(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;

  for (const [functionName, executions] of functionExecutionStore.entries()) {
    const originalLength = executions.length;
    const filtered = executions.filter(exec => new Date(exec.timestamp) >= cutoff);
    functionExecutionStore.set(functionName, filtered);
    cleared += originalLength - filtered.length;
  }

  return cleared;
}

/**
 * Wrap a function execution with automatic monitoring
 */
export async function withFunctionMonitoring<T>(
  functionName: string,
  fn: () => Promise<T>,
  correlationId?: string
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    trackFunctionExecution(functionName, duration, true, {
      correlationId,
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackFunctionExecution(functionName, duration, false, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get function execution trends over time
 */
export function getFunctionExecutionTrends(functionName?: string, buckets: number = 12): Array<{
  timestamp: string;
  avgDuration: number;
  p95Duration: number;
  successRate: number;
  count: number;
}> {
  const allExecutions: FunctionExecutionEvent[] = [];

  for (const executions of functionExecutionStore.values()) {
    if (functionName) {
      allExecutions.push(...executions.filter(e => e.functionName === functionName));
    } else {
      allExecutions.push(...executions);
    }
  }

  if (allExecutions.length === 0) return [];

  const now = Date.now();
  const bucketSize = (24 * 60 * 60 * 1000) / buckets; // 24 hours divided by buckets

  const trends: Array<{ timestamp: string; avgDuration: number; p95Duration: number; successRate: number; count: number }> = [];

  for (let i = 0; i < buckets; i++) {
    const bucketStart = now - (buckets - i) * bucketSize;
    const bucketEnd = now - (buckets - i - 1) * bucketSize;

    const bucketExecutions = allExecutions.filter(exec => {
      const timestamp = new Date(exec.timestamp).getTime();
      return timestamp >= bucketStart && timestamp < bucketEnd;
    });

    if (bucketExecutions.length > 0) {
      const durations = bucketExecutions.map(e => e.duration).sort((a, b) => a - b);
      const avgDuration = durations.reduce((sum, dur) => sum + dur, 0) / durations.length;
      const p95Index = Math.floor(durations.length * 0.95);
      const p95Duration = durations[p95Index] || 0;
      const successCount = bucketExecutions.filter(e => e.success).length;
      const successRate = (successCount / bucketExecutions.length) * 100;

      trends.push({
        timestamp: new Date(bucketStart).toISOString(),
        avgDuration,
        p95Duration,
        successRate,
        count: bucketExecutions.length,
      });
    }
  }

  return trends;
}

/**
 * Get function health status
 */
export function getFunctionHealthStatus(): {
  overallStatus: "healthy" | "degraded" | "unhealthy";
  functionHealth: Record<string, "healthy" | "degraded" | "unhealthy">;
  issues: Array<{ functionName: string; issue: string; severity: "low" | "medium" | "high" }>;
} {
  const stats = getFunctionStats();
  const functionHealth: Record<string, "healthy" | "degraded" | "unhealthy"> = {};
  const issues: Array<{ functionName: string; issue: string; severity: "low" | "medium" | "high" }> = [];

  // Determine health for each function
  for (const functionName of functionExecutionStore.keys()) {
    const functionStats = getFunctionStatsByName(functionName);
    
    if (functionStats.failureRate > 20) {
      functionHealth[functionName] = "unhealthy";
      issues.push({
        functionName,
        issue: `High failure rate: ${functionStats.failureRate.toFixed(1)}%`,
        severity: "high",
      });
    } else if (functionStats.failureRate > 10 || functionStats.averageDuration > 5000) {
      functionHealth[functionName] = "degraded";
      issues.push({
        functionName,
        issue: functionStats.failureRate > 10 
          ? `Elevated failure rate: ${functionStats.failureRate.toFixed(1)}%`
          : `Slow execution: ${functionStats.averageDuration.toFixed(0)}ms`,
        severity: "medium",
      });
    } else {
      functionHealth[functionName] = "healthy";
    }
  }

  // Determine overall status
  const unhealthyCount = Object.values(functionHealth).filter(status => status === "unhealthy").length;
  const degradedCount = Object.values(functionHealth).filter(status => status === "degraded").length;

  let overallStatus: "healthy" | "degraded" | "unhealthy";
  if (unhealthyCount > 0) {
    overallStatus = "unhealthy";
  } else if (degradedCount > 0) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  return {
    overallStatus,
    functionHealth,
    issues,
  };
}
