/**
 * Health Check Edge Function
 * 
 * Provides a lightweight health check endpoint for monitoring systems.
 * Returns component-level health status and basic metrics.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireEnv, getEnv } from '../_shared/env.ts';
import { startTelemetry, finishTelemetry, failTelemetry, withRequestId } from '../_shared/observability.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

// Use the shared, allowlisted CORS helper (reflects a known origin +
// Allow-Credentials) instead of a hand-rolled wildcard, for consistency
// with every other function. This endpoint's own data is low-sensitivity,
// but a wildcard here was the one outlier across the whole codebase.

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    auth: ComponentHealth;
    storage: ComponentHealth;
    edgeFunctions: ComponentHealth;
  };
  metrics?: {
    activeConnections?: number;
    requestsPerMinute?: number;
    errorRate?: number;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

// Track start time for uptime calculation
const startTime = Date.now();

serve(async (req: Request) => {
  const telemetry = startTelemetry(req, 'health-check');
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    finishTelemetry(telemetry, 204);
    return new Response(null, { headers: withRequestId(getCorsHeaders(req), telemetry.requestId), status: 204 });
  }

  const url = new URL(req.url);
  const detailed = url.searchParams.get('detailed') === 'true';
  const includeMetrics = url.searchParams.get('metrics') === 'true';

  const start = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: getEnv('APP_VERSION', '1.0.0'),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: 'healthy' },
      auth: { status: 'healthy' },
      storage: { status: 'healthy' },
      edgeFunctions: { status: 'healthy' },
    },
  };

  // Check Supabase connection
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    
    const dbStart = Date.now();
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    
    health.checks.database = {
      status: dbResponse.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - dbStart,
      error: dbResponse.ok ? undefined : `HTTP ${dbResponse.status}`,
    };
  } catch (e) {
    health.checks.database = {
      status: 'unhealthy',
      error: String(e),
    };
    health.status = 'degraded';
  }

  // Check Auth
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    
    const authStart = Date.now();
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    
    health.checks.auth = {
      status: authResponse.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - authStart,
      error: authResponse.ok ? undefined : `HTTP ${authResponse.status}`,
    };
  } catch (e) {
    health.checks.auth = {
      status: 'unhealthy',
      error: String(e),
    };
  }

  // Check Storage
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    
    const storageStart = Date.now();
    const storageResponse = await fetch(`${supabaseUrl}/storage/v1/health`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    
    health.checks.storage = {
      status: storageResponse.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - storageStart,
      error: storageResponse.ok ? undefined : `HTTP ${storageResponse.status}`,
    };
  } catch (e) {
    health.checks.storage = {
      status: 'unhealthy',
      error: String(e),
    };
  }

  // Edge functions are always healthy if this response is returned
  health.checks.edgeFunctions = {
    status: 'healthy',
    latencyMs: Date.now() - start,
  };

  // Determine overall status
  const components = Object.values(health.checks);
  if (components.some(c => c.status === 'unhealthy')) {
    health.status = 'unhealthy';
  } else if (components.some(c => c.status === 'degraded')) {
    health.status = 'degraded';
  }

  // Include metrics if requested
  if (includeMetrics) {
    try {
      // Query activity logs for metrics
      const supabaseUrl = requireEnv('SUPABASE_URL');
      const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
      
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      
      const metricsResponse = await fetch(
        `${supabaseUrl}/rest/v1/activity_logs?action=ilike.error%3A%&created_at=gt.${oneMinuteAgo}&select=id`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        health.metrics = {
          errorRate: data.length > 5 ? data.length / 100 : 0,
        };
      }
    } catch {
      // Metrics are optional
    }
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  finishTelemetry(telemetry, statusCode);

  return new Response(
    JSON.stringify(detailed ? health : {
      status: health.status,
      timestamp: health.timestamp,
      version: health.version,
    }),
    {
      headers: withRequestId({
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': health.status,
      }, telemetry.requestId),
      status: statusCode,
    }
  );
});
