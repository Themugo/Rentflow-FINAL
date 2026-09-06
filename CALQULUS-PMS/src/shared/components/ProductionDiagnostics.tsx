/**
 * CALQULUS PMS - Production Diagnostics Component
 * 
 * A lightweight diagnostic panel for support teams and developers
 * to quickly identify issues in production environments.
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger, checkHealth, generateCorrelationId } from '@/shared/lib/observability';
import { supabase } from '@/integrations/supabase/client';
import { X, RefreshCw, Activity, AlertCircle, CheckCircle, Clock, Database, Wifi, Server } from 'lucide-react';

const logger = createLogger('diagnostics');

interface DiagnosticResult {
  name: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warn';
  duration?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface SessionInfo {
  userId?: string;
  sessionId: string;
  role?: string;
  environment: string;
  version: string;
}

export function ProductionDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [correlationId, setCorrelationId] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Collect session info
  useEffect(() => {
    let isMounted = true;
    const cid = generateCorrelationId();
    setCorrelationId(cid);

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSessionInfo({
        sessionId: cid,
        userId: data.session?.user?.id,
        environment: import.meta.env.PROD ? 'production' : import.meta.env.MODE || 'development',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      });
    }).catch(() => {
      if (!isMounted) return;
      setSessionInfo({
        sessionId: cid,
        userId: undefined,
        environment: import.meta.env.PROD ? 'production' : import.meta.env.MODE || 'development',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setCorrelationId(generateCorrelationId());
    
    const results: DiagnosticResult[] = [
      { name: 'Supabase Connection', status: 'checking' },
      { name: 'Auth State', status: 'checking' },
      { name: 'Database Query', status: 'checking' },
      { name: 'Network Latency', status: 'checking' },
      { name: 'Browser Storage', status: 'checking' },
      { name: 'Web Vitals', status: 'checking' },
    ];

    setDiagnostics(results);

    // Check Supabase connection
    const supabaseCheck = { ...results[0] };
    const start = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      supabaseCheck.status = error ? 'fail' : 'pass';
      supabaseCheck.duration = Math.round(performance.now() - start);
      supabaseCheck.message = error ? error.message : 'Connected successfully';
      logger.info('Supabase connection check', { status: supabaseCheck.status, duration: supabaseCheck.duration });
    } catch (e) {
      supabaseCheck.status = 'fail';
      supabaseCheck.message = String(e);
      logger.error('Supabase connection failed', e);
    }

    // Check Auth state
    const authCheck = { ...results[1] };
    const { data: sessionData } = await supabase.auth.getSession();
    authCheck.status = sessionData.session ? 'pass' : 'warn';
    authCheck.message = sessionData.session ? 'User authenticated' : 'No active session';
    authCheck.details = {
      userId: sessionData.session?.user?.id,
      expiresAt: sessionData.session?.expires_at ? new Date(sessionData.session.expires_at * 1000).toISOString() : null,
    };
    logger.info('Auth state check', { status: authCheck.status });

    // Check database query
    const dbCheck = { ...results[2] };
    const dbStart = performance.now();
    try {
      const { data, error, count } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .limit(1);
      dbCheck.status = error ? 'fail' : 'pass';
      dbCheck.duration = Math.round(performance.now() - dbStart);
      dbCheck.message = error ? error.message : `Accessible (${count} logs)`;
      logger.info('Database query check', { status: dbCheck.status, duration: dbCheck.duration });
    } catch (e) {
      dbCheck.status = 'fail';
      dbCheck.message = String(e);
      logger.error('Database query failed', e);
    }

    // Check network latency
    const networkCheck = { ...results[3] };
    const networkStart = performance.now();
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        networkCheck.status = 'warn';
        networkCheck.message = 'Supabase URL not configured';
      } else {
        await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'HEAD',
          mode: 'no-cors',
        });
        networkCheck.status = 'pass';
        networkCheck.duration = Math.round(performance.now() - networkStart);
        networkCheck.message = `${networkCheck.duration}ms`;
        logger.info('Network latency check', { duration: networkCheck.duration });
      }
    } catch {
      networkCheck.status = 'warn';
      networkCheck.duration = Math.round(performance.now() - networkStart);
      networkCheck.message = 'Could not measure latency';
    }

    // Check browser storage
    const storageCheck = { ...results[4] };
    try {
      localStorage.setItem('__diag__', '1');
      localStorage.removeItem('__diag__');
      sessionStorage.setItem('__diag__', '1');
      sessionStorage.removeItem('__diag__');
      storageCheck.status = 'pass';
      storageCheck.message = 'Local & session storage available';
    } catch {
      storageCheck.status = 'warn';
      storageCheck.message = 'Storage may be restricted';
    }

    // Check Web Vitals
    const vitalsCheck = { ...results[5] };
    if (typeof window !== 'undefined' && window.PerformanceObserver) {
      const lcp = performance.getEntriesByType('largest-contentful-paint');
      const cls = performance.getEntriesByType('layout-shift');
      vitalsCheck.status = 'pass';
      vitalsCheck.details = {
        lcp: lcp.length > 0 ? Math.round((lcp[lcp.length - 1] as PerformanceEntry).startTime) : null,
        cls: cls.length > 0 ? cls.reduce((sum, e) => sum + (e as PerformanceEntry & { value: number }).value, 0) : null,
      };
      vitalsCheck.message = 'Performance metrics available';
    } else {
      vitalsCheck.status = 'warn';
      vitalsCheck.message = 'Performance metrics not available';
    }

    // Update all results
    setDiagnostics([supabaseCheck, authCheck, dbCheck, networkCheck, storageCheck, vitalsCheck]);
    setIsRunning(false);
  }, []);

  // Auto-run on mount
  useEffect(() => {
    if (isOpen && diagnostics.length === 0) {
      runDiagnostics();
    }
  }, [isOpen, diagnostics.length, runDiagnostics]);

  // Keyboard shortcut to toggle (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'fail': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warn': return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'checking': return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getOverallStatus = () => {
    const fails = diagnostics.filter(d => d.status === 'fail').length;
    const warns = diagnostics.filter(d => d.status === 'warn').length;
    if (fails > 0) return { status: 'unhealthy', color: 'text-red-500', label: 'Issues Detected' };
    if (warns > 0) return { status: 'degraded', color: 'text-warning', label: 'Minor Issues' };
    if (diagnostics.length === 0) return { status: 'unknown', color: 'text-gray-400', label: 'Not Run' };
    return { status: 'healthy', color: 'text-success', label: 'All Systems Operational' };
  };

  const overall = getOverallStatus();

  if (!isOpen) {
    // Floating button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg transition-colors"
        title="Open Diagnostics (Ctrl+Shift+D)"
      >
        <Activity className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${overall.status === 'healthy' ? 'bg-success/10 dark:bg-success/30' : overall.status === 'unhealthy' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <Activity className={`h-5 w-5 ${overall.color}`} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Production Diagnostics</h2>
              <p className={`text-sm ${overall.color}`}>{overall.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runDiagnostics}
              disabled={isRunning}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Session Info */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <span>Correlation ID: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{correlationId}</code></span>
            <span>Environment: <strong>{sessionInfo?.environment}</strong></span>
            <span>Version: <strong>{sessionInfo?.version}</strong></span>
          </div>
        </div>

        {/* Diagnostics List */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="space-y-3">
            {diagnostics.map((diag, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
              >
                {getStatusIcon(diag.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white">{diag.name}</span>
                    {diag.duration !== undefined && (
                      <span className="text-xs text-slate-500">{diag.duration}ms</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{diag.message}</p>
                  {diag.details && Object.keys(diag.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer">View Details</summary>
                      <pre className="mt-1 p-2 bg-slate-100 dark:bg-slate-900 rounded text-xs overflow-x-auto">
                        {JSON.stringify(diag.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {diagnostics.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Click refresh to run diagnostics
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Use Ctrl+Shift+D to toggle</span>
          <span>Report issue with correlation ID: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{correlationId.slice(0, 8)}</code></span>
        </div>
      </div>
    </div>
  );
}

export default ProductionDiagnostics;
