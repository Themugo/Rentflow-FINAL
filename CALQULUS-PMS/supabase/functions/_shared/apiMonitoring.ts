/**
 * _shared/apiMonitoring.ts
 *
 * API monitoring and latency tracking for CALQULUS PMS edge functions.
 *
 * Provides comprehensive API monitoring including latency tracking,
 * success rates, endpoint performance, and external service monitoring.
 *
 * Usage:
 *   import { trackApiCall, getApiStats, createApiReport } from "../_shared/apiMonitoring.ts";
 *
 *   trackApiCall("POST", "/api/payments/mpesa", 200, 150, { service: "paystack" });
 *   const stats = getApiStats();
 */

export interface ApiCallEvent {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  success: boolean;
  service?: string;
  correlationId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ApiStats {
  totalCalls: number;
  successRate: number;
  errorRate: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  callsByMethod: Record<string, number>;
  callsByEndpoint: Record<string, number>;
  callsByService: Record<string, number>;
  callsByStatusCode: Record<string, number>;
  recentCalls: ApiCallEvent[];
  slowEndpoints: Array<{ endpoint: string; avgLatency: number; count: number }>;
  errorEndpoints: Array<{ endpoint: string; errorRate: number; count: number }>;
}

// In-memory API call storage (in production, this would be a time-series database)
const apiCallStore = new Map<string, ApiCallEvent[]>();

/**
 * Generate a unique API call ID
 */
function generateApiCallId(): string {
  return crypto.randomUUID();
}

/**
 * Track an API call
 */
export function trackApiCall(
  method: string,
  endpoint: string,
  statusCode: number,
  duration: number,
  metadata: {
    service?: string;
    correlationId?: string;
    error?: string;
    [key: string]: any;
  } = {}
): string {
  const callId = generateApiCallId();
  const timestamp = new Date().toISOString();
  const success = statusCode >= 200 && statusCode < 400;

  const apiCall: ApiCallEvent = {
    id: callId,
    timestamp,
    method,
    endpoint,
    statusCode,
    duration,
    success,
    service: metadata.service,
    correlationId: metadata.correlationId,
    error: metadata.error,
    metadata,
  };

  const endpointKey = endpoint;
  if (!apiCallStore.has(endpointKey)) {
    apiCallStore.set(endpointKey, []);
  }

  const calls = apiCallStore.get(endpointKey)!;
  calls.push(apiCall);

  // Keep only last 1000 calls per endpoint
  if (calls.length > 1000) {
    calls.shift();
  }

  // Log slow calls (> 1 second)
  if (duration > 1000) {
    console.warn(`[API_MONITORING] Slow API call: ${method} ${endpoint} took ${duration}ms`, {
      callId,
      method,
      endpoint,
      duration,
      statusCode,
      correlationId: metadata.correlationId,
    });
  }

  // Log failed calls
  if (!success) {
    console.error(`[API_MONITORING] Failed API call: ${method} ${endpoint} returned ${statusCode}`, {
      callId,
      method,
      endpoint,
      statusCode,
      duration,
      error: metadata.error,
      correlationId: metadata.correlationId,
    });
  }

  return callId;
}

/**
 * Get API statistics
 */
export function getApiStats(timeRange?: { start: Date; end: Date }): ApiStats {
  const allCalls: ApiCallEvent[] = [];

  for (const calls of apiCallStore.values()) {
    allCalls.push(...calls);
  }

  let filteredCalls = allCalls;
  if (timeRange) {
    filteredCalls = allCalls.filter(call => {
      const callTime = new Date(call.timestamp);
      return callTime >= timeRange.start && callTime <= timeRange.end;
    });
  }

  const totalCalls = filteredCalls.length;
  const successCount = filteredCalls.filter(c => c.success).length;
  const errorCount = filteredCalls.filter(c => !c.success).length;

  const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;
  const errorRate = totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0;

  // Calculate latency percentiles
  const latencies = filteredCalls.map(c => c.duration).sort((a, b) => a - b);
  const averageLatency = latencies.length > 0 
    ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
    : 0;

  const p50Index = Math.floor(latencies.length * 0.5);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);

  const p50Latency = latencies[p50Index] || 0;
  const p95Latency = latencies[p95Index] || 0;
  const p99Latency = latencies[p99Index] || 0;

  // Group by method
  const callsByMethod: Record<string, number> = {};
  filteredCalls.forEach(call => {
    callsByMethod[call.method] = (callsByMethod[call.method] || 0) + 1;
  });

  // Group by endpoint
  const callsByEndpoint: Record<string, number> = {};
  filteredCalls.forEach(call => {
    callsByEndpoint[call.endpoint] = (callsByEndpoint[call.endpoint] || 0) + 1;
  });

  // Group by service
  const callsByService: Record<string, number> = {};
  filteredCalls.forEach(call => {
    if (call.service) {
      callsByService[call.service] = (callsByService[call.service] || 0) + 1;
    }
  });

  // Group by status code
  const callsByStatusCode: Record<string, number> = {};
  filteredCalls.forEach(call => {
    callsByStatusCode[call.statusCode.toString()] = (callsByStatusCode[call.statusCode.toString()] || 0) + 1;
  });

  // Get recent calls
  const recentCalls = filteredCalls.slice(-20);

  // Get slow endpoints (avg latency > 500ms)
  const endpointLatencies = new Map<string, { total: number; count: number }>();
  filteredCalls.forEach(call => {
    if (!endpointLatencies.has(call.endpoint)) {
      endpointLatencies.set(call.endpoint, { total: 0, count: 0 });
    }
    const data = endpointLatencies.get(call.endpoint)!;
    data.total += call.duration;
    data.count++;
  });

  const slowEndpoints = Array.from(endpointLatencies.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      avgLatency: data.total / data.count,
      count: data.count,
    }))
    .filter(ep => ep.avgLatency > 500)
    .sort((a, b) => b.avgLatency - a.avgLatency)
    .slice(0, 10);

  // Get error endpoints (error rate > 10%)
  const endpointErrors = new Map<string, { errors: number; total: number }>();
  filteredCalls.forEach(call => {
    if (!endpointErrors.has(call.endpoint)) {
      endpointErrors.set(call.endpoint, { errors: 0, total: 0 });
    }
    const data = endpointErrors.get(call.endpoint)!;
    data.total++;
    if (!call.success) {
      data.errors++;
    }
  });

  const errorEndpoints = Array.from(endpointErrors.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      errorRate: (data.errors / data.total) * 100,
      count: data.total,
    }))
    .filter(ep => ep.errorRate > 10)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 10);

  return {
    totalCalls,
    successRate,
    errorRate,
    averageLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    callsByMethod,
    callsByEndpoint,
    callsByService,
    callsByStatusCode,
    recentCalls,
    slowEndpoints,
    errorEndpoints,
  };
}

/**
 * Get API statistics for a specific service
 */
export function getServiceStats(serviceName: string, timeRange?: { start: Date; end: Date }): {
  totalCalls: number;
  successRate: number;
  averageLatency: number;
  errorRate: number;
  recentCalls: ApiCallEvent[];
} {
  const allCalls: ApiCallEvent[] = [];

  for (const calls of apiCallStore.values()) {
    allCalls.push(...calls.filter(c => c.service === serviceName));
  }

  let filteredCalls = allCalls;
  if (timeRange) {
    filteredCalls = allCalls.filter(call => {
      const callTime = new Date(call.timestamp);
      return callTime >= timeRange.start && callTime <= timeRange.end;
    });
  }

  const totalCalls = filteredCalls.length;
  const successCount = filteredCalls.filter(c => c.success).length;
  const errorCount = filteredCalls.filter(c => !c.success).length;

  const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;
  const errorRate = totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0;

  const averageLatency = filteredCalls.length > 0
    ? filteredCalls.reduce((sum, call) => sum + call.duration, 0) / filteredCalls.length
    : 0;

  return {
    totalCalls,
    successRate,
    averageLatency,
    errorRate,
    recentCalls: filteredCalls.slice(-10),
  };
}

/**
 * Create an API monitoring report
 */
export function createApiReport(timeRange: { start: Date; end: Date }): {
  summary: string;
  stats: ApiStats;
  serviceStats: Record<string, ReturnType<typeof getServiceStats>>;
  recommendations: string[];
} {
  const stats = getApiStats(timeRange);
  const serviceStats: Record<string, ReturnType<typeof getServiceStats>> = {};
  const recommendations: string[] = [];

  // Get stats for each service
  const services = new Set<string>();
  for (const calls of apiCallStore.values()) {
    calls.forEach(call => {
      if (call.service) {
        services.add(call.service);
      }
    });
  }

  services.forEach(service => {
    serviceStats[service] = getServiceStats(service, timeRange);
  });

  // Generate recommendations
  if (stats.successRate < 95) {
    recommendations.push("Low API success rate detected: Review error endpoints and implement fixes");
  }

  if (stats.averageLatency > 500) {
    recommendations.push("High average API latency: Review slow endpoints and optimize performance");
  }

  if (stats.p95Latency > 2000) {
    recommendations.push("High P95 latency: Some API calls are taking too long, investigate outliers");
  }

  if (stats.slowEndpoints.length > 0) {
    recommendations.push(`Slow endpoints detected: ${stats.slowEndpoints.map(ep => ep.endpoint).join(", ")}`);
  }

  if (stats.errorEndpoints.length > 0) {
    recommendations.push(`High error rate endpoints: ${stats.errorEndpoints.map(ep => ep.endpoint).join(", ")}`);
  }

  // Service-specific recommendations
  if (serviceStats["paystack"] && serviceStats["paystack"].errorRate > 5) {
    recommendations.push("Paystack API errors: Check API credentials and rate limits");
  }

  if (serviceStats["supabase"] && serviceStats["supabase"].averageLatency > 300) {
    recommendations.push("Supabase API latency: Review database queries and connection pooling");
  }

  const summary = `API Monitoring Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${stats.totalCalls} calls, ${stats.successRate.toFixed(1)}% success rate, ${stats.averageLatency.toFixed(0)}ms avg latency`;

  return {
    summary,
    stats,
    serviceStats,
    recommendations,
  };
}

/**
 * Clear old API calls (for memory management)
 */
export function clearOldApiCalls(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;

  for (const [endpoint, calls] of apiCallStore.entries()) {
    const originalLength = calls.length;
    const filtered = calls.filter(call => new Date(call.timestamp) >= cutoff);
    apiCallStore.set(endpoint, filtered);
    cleared += originalLength - filtered.length;
  }

  return cleared;
}

/**
 * Wrap a fetch call with automatic API monitoring
 */
export async function withApiMonitoring<T>(
  url: string,
  options: RequestInit = {},
  service?: string,
  correlationId?: string
): Promise<T> {
  const method = options.method || "GET";
  const startTime = performance.now();

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - startTime;

    trackApiCall(method, url, response.status, duration, {
      service,
      correlationId,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackApiCall(method, url, 0, duration, {
      service,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get API latency trends over time
 */
export function getApiLatencyTrends(endpoint?: string, buckets: number = 12): Array<{
  timestamp: string;
  avgLatency: number;
  p95Latency: number;
  count: number;
}> {
  const allCalls: ApiCallEvent[] = [];

  for (const calls of apiCallStore.values()) {
    if (endpoint) {
      allCalls.push(...calls.filter(c => c.endpoint === endpoint));
    } else {
      allCalls.push(...calls);
    }
  }

  if (allCalls.length === 0) return [];

  const now = Date.now();
  const bucketSize = (24 * 60 * 60 * 1000) / buckets; // 24 hours divided by buckets

  const trends: Array<{ timestamp: string; avgLatency: number; p95Latency: number; count: number }> = [];

  for (let i = 0; i < buckets; i++) {
    const bucketStart = now - (buckets - i) * bucketSize;
    const bucketEnd = now - (buckets - i - 1) * bucketSize;

    const bucketCalls = allCalls.filter(call => {
      const timestamp = new Date(call.timestamp).getTime();
      return timestamp >= bucketStart && timestamp < bucketEnd;
    });

    if (bucketCalls.length > 0) {
      const latencies = bucketCalls.map(c => c.duration).sort((a, b) => a - b);
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index] || 0;

      trends.push({
        timestamp: new Date(bucketStart).toISOString(),
        avgLatency,
        p95Latency,
        count: bucketCalls.length,
      });
    }
  }

  return trends;
}
