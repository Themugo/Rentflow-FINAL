/**
 * _shared/databaseMonitoring.ts
 *
 * Database monitoring and latency tracking for CALQULUS PMS edge functions.
 *
 * Provides comprehensive database monitoring including query latency,
 * success rates, table performance, and connection pool monitoring.
 *
 * Usage:
 *   import { trackDatabaseQuery, getDatabaseStats, createDatabaseReport } from "../_shared/databaseMonitoring.ts";
 *
 *   trackDatabaseQuery("SELECT", "tenants", 50, true, { rows: 10 });
 *   const stats = getDatabaseStats();
 */

export interface DatabaseQueryEvent {
  id: string;
  timestamp: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "EXEC" | "OTHER";
  table: string;
  duration: number;
  success: boolean;
  rowsAffected?: number;
  error?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface DatabaseStats {
  totalQueries: number;
  successRate: number;
  errorRate: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  queriesByOperation: Record<string, number>;
  queriesByTable: Record<string, number>;
  queriesBySuccess: Record<string, number>;
  recentQueries: DatabaseQueryEvent[];
  slowQueries: Array<{ operation: string; table: string; avgLatency: number; count: number }>;
  errorQueries: Array<{ operation: string; table: string; errorRate: number; count: number }>;
  totalRowsAffected: number;
}

// In-memory database query storage (in production, this would be a time-series database)
const databaseQueryStore = new Map<string, DatabaseQueryEvent[]>();

/**
 * Generate a unique query ID
 */
function generateQueryId(): string {
  return crypto.randomUUID();
}

/**
 * Track a database query
 */
export function trackDatabaseQuery(
  operation: DatabaseQueryEvent["operation"],
  table: string,
  duration: number,
  success: boolean,
  metadata: {
    rowsAffected?: number;
    correlationId?: string;
    error?: string;
    [key: string]: any;
  } = {}
): string {
  const queryId = generateQueryId();
  const timestamp = new Date().toISOString();

  const queryEvent: DatabaseQueryEvent = {
    id: queryId,
    timestamp,
    operation,
    table,
    duration,
    success,
    rowsAffected: metadata.rowsAffected,
    error: metadata.error,
    correlationId: metadata.correlationId,
    metadata,
  };

  const tableKey = table;
  if (!databaseQueryStore.has(tableKey)) {
    databaseQueryStore.set(tableKey, []);
  }

  const queries = databaseQueryStore.get(tableKey)!;
  queries.push(queryEvent);

  // Keep only last 1000 queries per table
  if (queries.length > 1000) {
    queries.shift();
  }

  // Log slow queries (> 200ms)
  if (duration > 200) {
    console.warn(`[DATABASE_MONITORING] Slow query: ${operation} on ${table} took ${duration}ms`, {
      queryId,
      operation,
      table,
      duration,
      correlationId: metadata.correlationId,
    });
  }

  // Log failed queries
  if (!success) {
    console.error(`[DATABASE_MONITORING] Failed query: ${operation} on ${table}`, {
      queryId,
      operation,
      table,
      duration,
      error: metadata.error,
      correlationId: metadata.correlationId,
    });
  }

  return queryId;
}

/**
 * Get database statistics
 */
export function getDatabaseStats(timeRange?: { start: Date; end: Date }): DatabaseStats {
  const allQueries: DatabaseQueryEvent[] = [];

  for (const queries of databaseQueryStore.values()) {
    allQueries.push(...queries);
  }

  let filteredQueries = allQueries;
  if (timeRange) {
    filteredQueries = allQueries.filter(query => {
      const queryTime = new Date(query.timestamp);
      return queryTime >= timeRange.start && queryTime <= timeRange.end;
    });
  }

  const totalQueries = filteredQueries.length;
  const successCount = filteredQueries.filter(q => q.success).length;
  const errorCount = filteredQueries.filter(q => !q.success).length;

  const successRate = totalQueries > 0 ? (successCount / totalQueries) * 100 : 0;
  const errorRate = totalQueries > 0 ? (errorCount / totalQueries) * 100 : 0;

  // Calculate latency percentiles
  const latencies = filteredQueries.map(q => q.duration).sort((a, b) => a - b);
  const averageLatency = latencies.length > 0 
    ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
    : 0;

  const p50Index = Math.floor(latencies.length * 0.5);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);

  const p50Latency = latencies[p50Index] || 0;
  const p95Latency = latencies[p95Index] || 0;
  const p99Latency = latencies[p99Index] || 0;

  // Group by operation
  const queriesByOperation: Record<string, number> = {};
  filteredQueries.forEach(query => {
    queriesByOperation[query.operation] = (queriesByOperation[query.operation] || 0) + 1;
  });

  // Group by table
  const queriesByTable: Record<string, number> = {};
  filteredQueries.forEach(query => {
    queriesByTable[query.table] = (queriesByTable[query.table] || 0) + 1;
  });

  // Group by success
  const queriesBySuccess: Record<string, number> = {
    success: successCount,
    error: errorCount,
  };

  // Get recent queries
  const recentQueries = filteredQueries.slice(-20);

  // Get slow queries (avg latency > 100ms)
  const queryLatencies = new Map<string, { total: number; count: number; operation: string; table: string }>();
  filteredQueries.forEach(query => {
    const key = `${query.operation}:${query.table}`;
    if (!queryLatencies.has(key)) {
      queryLatencies.set(key, { total: 0, count: 0, operation: query.operation, table: query.table });
    }
    const data = queryLatencies.get(key)!;
    data.total += query.duration;
    data.count++;
  });

  const slowQueries = Array.from(queryLatencies.entries())
    .map(([key, data]) => ({
      operation: data.operation,
      table: data.table,
      avgLatency: data.total / data.count,
      count: data.count,
    }))
    .filter(q => q.avgLatency > 100)
    .sort((a, b) => b.avgLatency - a.avgLatency)
    .slice(0, 10);

  // Get error queries (error rate > 5%)
  const queryErrors = new Map<string, { errors: number; total: number; operation: string; table: string }>();
  filteredQueries.forEach(query => {
    const key = `${query.operation}:${query.table}`;
    if (!queryErrors.has(key)) {
      queryErrors.set(key, { errors: 0, total: 0, operation: query.operation, table: query.table });
    }
    const data = queryErrors.get(key)!;
    data.total++;
    if (!query.success) {
      data.errors++;
    }
  });

  const errorQueries = Array.from(queryErrors.entries())
    .map(([key, data]) => ({
      operation: data.operation,
      table: data.table,
      errorRate: (data.errors / data.total) * 100,
      count: data.total,
    }))
    .filter(q => q.errorRate > 5)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 10);

  // Calculate total rows affected
  const totalRowsAffected = filteredQueries
    .filter(q => q.rowsAffected !== undefined)
    .reduce((sum, q) => sum + (q.rowsAffected || 0), 0);

  return {
    totalQueries,
    successRate,
    errorRate,
    averageLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    queriesByOperation,
    queriesByTable,
    queriesBySuccess,
    recentQueries,
    slowQueries,
    errorQueries,
    totalRowsAffected,
  };
}

/**
 * Get database statistics for a specific table
 */
export function getTableStats(tableName: string, timeRange?: { start: Date; end: Date }): {
  totalQueries: number;
  successRate: number;
  averageLatency: number;
  errorRate: number;
  queriesByOperation: Record<string, number>;
  recentQueries: DatabaseQueryEvent[];
} {
  const tableQueries = databaseQueryStore.get(tableName) || [];
  
  let filteredQueries = tableQueries;
  if (timeRange) {
    filteredQueries = tableQueries.filter(query => {
      const queryTime = new Date(query.timestamp);
      return queryTime >= timeRange.start && queryTime <= timeRange.end;
    });
  }

  const totalQueries = filteredQueries.length;
  const successCount = filteredQueries.filter(q => q.success).length;
  const errorCount = filteredQueries.filter(q => !q.success).length;

  const successRate = totalQueries > 0 ? (successCount / totalQueries) * 100 : 0;
  const errorRate = totalQueries > 0 ? (errorCount / totalQueries) * 100 : 0;

  const averageLatency = filteredQueries.length > 0
    ? filteredQueries.reduce((sum, query) => sum + query.duration, 0) / filteredQueries.length
    : 0;

  const queriesByOperation: Record<string, number> = {};
  filteredQueries.forEach(query => {
    queriesByOperation[query.operation] = (queriesByOperation[query.operation] || 0) + 1;
  });

  return {
    totalQueries,
    successRate,
    averageLatency,
    errorRate,
    queriesByOperation,
    recentQueries: filteredQueries.slice(-10),
  };
}

/**
 * Create a database monitoring report
 */
export function createDatabaseReport(timeRange: { start: Date; end: Date }): {
  summary: string;
  stats: DatabaseStats;
  tableStats: Record<string, ReturnType<typeof getTableStats>>;
  recommendations: string[];
} {
  const stats = getDatabaseStats(timeRange);
  const tableStats: Record<string, ReturnType<typeof getTableStats>> = {};
  const recommendations: string[] = [];

  // Get stats for each table
  for (const tableName of databaseQueryStore.keys()) {
    tableStats[tableName] = getTableStats(tableName, timeRange);
  }

  // Generate recommendations
  if (stats.successRate < 98) {
    recommendations.push("Low database success rate detected: Review error queries and fix issues");
  }

  if (stats.averageLatency > 100) {
    recommendations.push("High average database latency: Review slow queries and optimize indexes");
  }

  if (stats.p95Latency > 500) {
    recommendations.push("High P95 latency: Some queries are taking too long, investigate outliers");
  }

  if (stats.slowQueries.length > 0) {
    recommendations.push(`Slow queries detected: ${stats.slowQueries.map(q => `${q.operation} ${q.table}`).join(", ")}`);
  }

  if (stats.errorQueries.length > 0) {
    recommendations.push(`High error rate queries: ${stats.errorQueries.map(q => `${q.operation} ${q.table}`).join(", ")}`);
  }

  // Table-specific recommendations
  if (tableStats["tenants"] && tableStats["tenants"].averageLatency > 150) {
    recommendations.push("Tenants table queries are slow: Consider adding indexes on frequently queried columns");
  }

  if (tableStats["payments"] && tableStats["payments"].errorRate > 2) {
    recommendations.push("Payments table has errors: Review payment processing logic and constraints");
  }

  const summary = `Database Monitoring Report (${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}): ${stats.totalQueries} queries, ${stats.successRate.toFixed(1)}% success rate, ${stats.averageLatency.toFixed(0)}ms avg latency`;

  return {
    summary,
    stats,
    tableStats,
    recommendations,
  };
}

/**
 * Clear old database queries (for memory management)
 */
export function clearOldDatabaseQueries(olderThanHours: number = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  let cleared = 0;

  for (const [table, queries] of databaseQueryStore.entries()) {
    const originalLength = queries.length;
    const filtered = queries.filter(query => new Date(query.timestamp) >= cutoff);
    databaseQueryStore.set(table, filtered);
    cleared += originalLength - filtered.length;
  }

  return cleared;
}

/**
 * Wrap a Supabase query with automatic database monitoring
 */
export async function withDatabaseMonitoring<T>(
  operation: DatabaseQueryEvent["operation"],
  table: string,
  fn: () => Promise<T>,
  correlationId?: string
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    trackDatabaseQuery(operation, table, duration, true, {
      correlationId,
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackDatabaseQuery(operation, table, duration, false, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get database latency trends over time
 */
export function getDatabaseLatencyTrends(table?: string, operation?: string, buckets: number = 12): Array<{
  timestamp: string;
  avgLatency: number;
  p95Latency: number;
  count: number;
}> {
  const allQueries: DatabaseQueryEvent[] = [];

  for (const queries of databaseQueryStore.values()) {
    let filtered = queries;
    if (table) {
      filtered = filtered.filter(q => q.table === table);
    }
    if (operation) {
      filtered = filtered.filter(q => q.operation === operation);
    }
    allQueries.push(...filtered);
  }

  if (allQueries.length === 0) return [];

  const now = Date.now();
  const bucketSize = (24 * 60 * 60 * 1000) / buckets; // 24 hours divided by buckets

  const trends: Array<{ timestamp: string; avgLatency: number; p95Latency: number; count: number }> = [];

  for (let i = 0; i < buckets; i++) {
    const bucketStart = now - (buckets - i) * bucketSize;
    const bucketEnd = now - (buckets - i - 1) * bucketSize;

    const bucketQueries = allQueries.filter(query => {
      const timestamp = new Date(query.timestamp).getTime();
      return timestamp >= bucketStart && timestamp < bucketEnd;
    });

    if (bucketQueries.length > 0) {
      const latencies = bucketQueries.map(q => q.duration).sort((a, b) => a - b);
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index] || 0;

      trends.push({
        timestamp: new Date(bucketStart).toISOString(),
        avgLatency,
        p95Latency,
        count: bucketQueries.length,
      });
    }
  }

  return trends;
}

/**
 * Get query performance by operation type
 */
export function getQueryPerformanceByOperation(): Record<string, {
  totalQueries: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
}> {
  const allQueries: DatabaseQueryEvent[] = [];

  for (const queries of databaseQueryStore.values()) {
    allQueries.push(...queries);
  }

  const performanceByOperation: Record<string, {
    totalQueries: number;
    averageLatency: number;
    successRate: number;
    errorRate: number;
  }> = {};

  const operationGroups = new Map<string, { latencies: number[]; successCount: number; totalCount: number }>();

  allQueries.forEach(query => {
    if (!operationGroups.has(query.operation)) {
      operationGroups.set(query.operation, { latencies: [], successCount: 0, totalCount: 0 });
    }
    const data = operationGroups.get(query.operation)!;
    data.latencies.push(query.duration);
    data.totalCount++;
    if (query.success) {
      data.successCount++;
    }
  });

  operationGroups.forEach((data, operation) => {
    const averageLatency = data.latencies.reduce((sum, lat) => sum + lat, 0) / data.latencies.length;
    const successRate = (data.successCount / data.totalCount) * 100;
    const errorRate = ((data.totalCount - data.successCount) / data.totalCount) * 100;

    performanceByOperation[operation] = {
      totalQueries: data.totalCount,
      averageLatency,
      successRate,
      errorRate,
    };
  });

  return performanceByOperation;
}
