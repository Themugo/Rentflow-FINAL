/**
 * _shared/metrics.ts
 *
 * Performance metrics collection for CALQULUS PMS edge functions.
 *
 * Provides comprehensive metrics collection for monitoring system performance,
 * API latency, database operations, and business metrics.
 *
 * Usage:
 *   import { recordMetric, getMetrics, createMetricsReport } from "../_shared/metrics.ts";
 *
 *   recordMetric("payment_processing_time", 150, { paymentMethod: "mpesa" });
 *   const metrics = getMetrics();
 */

export interface MetricValue {
  value: number;
  timestamp: string;
  tags: Record<string, string>;
}

export interface MetricSummary {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  tags: Record<string, string>;
}

export interface MetricsReport {
  summary: string;
  timeRange: { start: string; end: string };
  apiMetrics: MetricSummary[];
  databaseMetrics: MetricSummary[];
  businessMetrics: MetricSummary[];
  systemMetrics: MetricSummary[];
}

// In-memory metrics storage (in production, this would be a time-series database)
const metricsStore = new Map<string, MetricValue[]>();

/**
 * Record a metric value
 */
export function recordMetric(
  name: string,
  value: number,
  tags: Record<string, string> = {}
): void {
  const metric: MetricValue = {
    value,
    timestamp: new Date().toISOString(),
    tags,
  };

  if (!metricsStore.has(name)) {
    metricsStore.set(name, []);
  }

  const values = metricsStore.get(name)!;
  values.push(metric);

  // Keep only last 1000 values per metric to prevent memory issues
  if (values.length > 1000) {
    values.shift();
  }
}

/**
 * Record API latency
 */
export function recordApiLatency(
  endpoint: string,
  duration: number,
  method: string = "GET",
  status: number = 200
): void {
  recordMetric("api_latency", duration, {
    endpoint,
    method,
    status: status.toString(),
  });
}

/**
 * Record database operation latency
 */
export function recordDatabaseLatency(
  operation: string,
  table: string,
  duration: number,
  success: boolean = true
): void {
  recordMetric("database_latency", duration, {
    operation,
    table,
    success: success.toString(),
  });
}

/**
 * Record edge function execution time
 */
export function recordFunctionExecution(
  functionName: string,
  duration: number,
  success: boolean = true
): void {
  recordMetric("function_execution", duration, {
    function: functionName,
    success: success.toString(),
  });
}

/**
 * Record business metric (e.g., payment success rate)
 */
export function recordBusinessMetric(
  metricName: string,
  value: number,
  context: Record<string, string> = {}
): void {
  recordMetric(`business_${metricName}`, value, context);
}

/**
 * Get all metrics for a specific name
 */
export function getMetricValues(name: string, timeRange?: { start: Date; end: Date }): MetricValue[] {
  const values = metricsStore.get(name) || [];
  
  if (!timeRange) {
    return values;
  }

  return values.filter(metric => {
    const metricTime = new Date(metric.timestamp);
    return metricTime >= timeRange.start && metricTime <= timeRange.end;
  });
}

/**
 * Calculate metric summary statistics
 */
export function calculateMetricSummary(name: string, timeRange?: { start: Date; end: Date }): MetricSummary | null {
  const values = getMetricValues(name, timeRange);
  
  if (values.length === 0) {
    return null;
  }

  const numericValues = values.map(v => v.value);
  const sorted = [...numericValues].sort((a, b) => a - b);

  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const avg = sorted.reduce((sum, val) => sum + val, 0) / count;

  // Calculate percentiles
  const p50Index = Math.floor(count * 0.5);
  const p95Index = Math.floor(count * 0.95);
  const p99Index = Math.floor(count * 0.99);

  const p50 = sorted[p50Index];
  const p95 = sorted[p95Index];
  const p99 = sorted[p99Index];

  // Get most common tags
  const tags: Record<string, string> = {};
  if (values.length > 0) {
    Object.keys(values[0].tags).forEach(key => {
      const tagCounts = new Map<string, number>();
      values.forEach(v => {
        const tagValue = v.tags[key];
        tagCounts.set(tagValue, (tagCounts.get(tagValue) || 0) + 1);
      });
      const mostCommon = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (mostCommon) {
        tags[key] = mostCommon[0];
      }
    });
  }

  return {
    name,
    count,
    min,
    max,
    avg,
    p50,
    p95,
    p99,
    tags,
  };
}

/**
 * Get all metrics summaries
 */
export function getMetrics(timeRange?: { start: Date; end: Date }): {
  apiMetrics: MetricSummary[];
  databaseMetrics: MetricSummary[];
  businessMetrics: MetricSummary[];
  systemMetrics: MetricSummary[];
} {
  const apiMetrics: MetricSummary[] = [];
  const databaseMetrics: MetricSummary[] = [];
  const businessMetrics: MetricSummary[] = [];
  const systemMetrics: MetricSummary[] = [];

  for (const name of metricsStore.keys()) {
    const summary = calculateMetricSummary(name, timeRange);
    if (!summary) continue;

    if (name.startsWith("api_")) {
      apiMetrics.push(summary);
    } else if (name.startsWith("database_")) {
      databaseMetrics.push(summary);
    } else if (name.startsWith("business_")) {
      businessMetrics.push(summary);
    } else {
      systemMetrics.push(summary);
    }
  }

  return {
    apiMetrics,
    databaseMetrics,
    businessMetrics,
    systemMetrics,
  };
}

/**
 * Create a comprehensive metrics report
 */
export function createMetricsReport(timeRange: { start: Date; end: Date }): MetricsReport {
  const metrics = getMetrics(timeRange);
  
  const totalMetrics = 
    metrics.apiMetrics.length + 
    metrics.databaseMetrics.length + 
    metrics.businessMetrics.length + 
    metrics.systemMetrics.length;

  const summary = `Metrics Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${totalMetrics} metric types tracked`;

  return {
    summary,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
    apiMetrics: metrics.apiMetrics,
    databaseMetrics: metrics.databaseMetrics,
    businessMetrics: metrics.businessMetrics,
    systemMetrics: metrics.systemMetrics,
  };
}

/**
 * Clear old metrics (for memory management)
 */
export function clearOldMetrics(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;

  for (const [name, values] of metricsStore.entries()) {
    const originalLength = values.length;
    const filtered = values.filter(metric => new Date(metric.timestamp) >= cutoff);
    metricsStore.set(name, filtered);
    cleared += originalLength - filtered.length;
  }

  return cleared;
}

/**
 * Wrap a function with automatic metrics recording
 */
export function withMetrics<T extends (...args: any[]) => any>(
  fn: T,
  metricName: string,
  tags: Record<string, string> = {}
): T {
  return ((...args: any[]) => {
    const startTime = performance.now();
    try {
      const result = fn(...args);
      const duration = performance.now() - startTime;
      recordMetric(metricName, duration, { ...tags, success: "true" });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      recordMetric(metricName, duration, { ...tags, success: "false" });
      throw error;
    }
  }) as T;
}

/**
 * Wrap an async function with automatic metrics recording
 */
export function withAsyncMetrics<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  metricName: string,
  tags: Record<string, string> = {}
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - startTime;
      recordMetric(metricName, duration, { ...tags, success: "true" });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      recordMetric(metricName, duration, { ...tags, success: "false" });
      throw error;
    }
  }) as T;
}

/**
 * Get health check metrics
 */
export function getHealthCheckMetrics(): {
  status: "healthy" | "degraded" | "unhealthy";
  metrics: {
    avgApiLatency: number;
    avgDatabaseLatency: number;
    avgFunctionExecution: number;
    errorRate: number;
  };
  checks: {
    apiLatency: "pass" | "fail";
    databaseLatency: "pass" | "fail";
    functionExecution: "pass" | "fail";
  };
} {
  const apiSummary = calculateMetricSummary("api_latency");
  const dbSummary = calculateMetricSummary("database_latency");
  const funcSummary = calculateMetricSummary("function_execution");

  const avgApiLatency = apiSummary?.avg || 0;
  const avgDatabaseLatency = dbSummary?.avg || 0;
  const avgFunctionExecution = funcSummary?.avg || 0;

  // Calculate error rate (failed operations / total operations)
  const apiFailed = getMetricValues("api_latency").filter(m => m.tags.success === "false").length;
  const apiTotal = getMetricValues("api_latency").length;
  const errorRate = apiTotal > 0 ? (apiFailed / apiTotal) * 100 : 0;

  // Health check thresholds
  const apiLatencyCheck = avgApiLatency < 1000; // < 1 second
  const dbLatencyCheck = avgDatabaseLatency < 500; // < 500ms
  const funcExecutionCheck = avgFunctionExecution < 5000; // < 5 seconds

  const checks: {
    apiLatency: "pass" | "fail";
    databaseLatency: "pass" | "fail";
    functionExecution: "pass" | "fail";
  } = {
    apiLatency: apiLatencyCheck ? "pass" : "fail",
    databaseLatency: dbLatencyCheck ? "pass" : "fail",
    functionExecution: funcExecutionCheck ? "pass" : "fail",
  };

  const allPass = Object.values(checks).every(check => check === "pass");
  const someFail = Object.values(checks).some(check => check === "fail");

  const status = allPass ? "healthy" : someFail ? "degraded" : "unhealthy";

  return {
    status,
    metrics: {
      avgApiLatency,
      avgDatabaseLatency,
      avgFunctionExecution,
      errorRate,
    },
    checks,
  };
}

/**
 * Get performance trends over time
 */
export function getPerformanceTrends(metricName: string, buckets: number = 12): Array<{
  timestamp: string;
  avg: number;
  count: number;
}> {
  const values = getMetricValues(metricName);
  if (values.length === 0) return [];

  const now = Date.now();
  const bucketSize = (24 * 60 * 60 * 1000) / buckets; // 24 hours divided by buckets

  const trends: Array<{ timestamp: string; avg: number; count: number }> = [];

  for (let i = 0; i < buckets; i++) {
    const bucketStart = now - (buckets - i) * bucketSize;
    const bucketEnd = now - (buckets - i - 1) * bucketSize;

    const bucketValues = values.filter(v => {
      const timestamp = new Date(v.timestamp).getTime();
      return timestamp >= bucketStart && timestamp < bucketEnd;
    });

    if (bucketValues.length > 0) {
      const avg = bucketValues.reduce((sum, v) => sum + v.value, 0) / bucketValues.length;
      trends.push({
        timestamp: new Date(bucketStart).toISOString(),
        avg,
        count: bucketValues.length,
      });
    }
  }

  return trends;
}
