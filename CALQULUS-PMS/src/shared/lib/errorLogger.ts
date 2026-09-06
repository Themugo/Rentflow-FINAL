/**
 * CALQULUS PMS Error Logger — Production Observability
 *
 * Two sinks:
 *   1. Supabase `activity_logs` table (always on) — auditable, queryable,
 *      and visible to webhost admins from inside the app.
 *   2. Sentry (optional, enabled when VITE_SENTRY_DSN is set) — gives us
 *      stack traces with source maps, release tagging, and alerting.
 *
 * View activity-log errors:
 *   SELECT * FROM activity_logs WHERE action LIKE 'error:%' ORDER BY created_at DESC;
 */
import { supabase } from '@/integrations/supabase/client';
import { captureException, captureMessage } from './sentry';

const isDev = import.meta.env.DEV;

const sanitize = (e: unknown): string => {
  if (e instanceof Error) return isDev ? e.message + '\n' + e.stack : e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return 'Unknown error'; }
};

const RAW_DB_PATTERNS = [
  /violates (check|foreign key|unique|not-null) constraint/i,
  /duplicate key value/i,
  /permission denied for (table|schema|relation)/i,
  /row-level security/i,
  /column .+ does not exist/i,
  /relation .+ does not exist/i,
  /PGRST/i,
  /\b22P02\b|\b23503\b|\b23505\b|\b42501\b/,
  /\bJWT\b/i,
  /TypeError:/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
  /failed to fetch/i,
  /networkerror/i,
  /econnrefused/i,
  /supabase/i,
  /postgrest/i,
  /at\s+\S+\s+\(/,
];

/**
 * User-facing copy for toasts. Logs the raw error; never surfaces PostgREST/SQL.
 */
export function toUserFacingError(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : typeof error === 'string'
          ? error
          : '';

  if (!raw) return fallback;
  if (RAW_DB_PATTERNS.some((re) => re.test(raw))) return fallback;
  if (raw.length > 180) return fallback;
  return raw;
}

export const logError = (context: string, error: unknown): void => {
  const msg = sanitize(error);
  if (isDev) console.error('[ERROR] ' + context + ':', error);

  captureException(error instanceof Error ? error : new Error(msg), { context });

  supabase.rpc('log_activity', {
    p_action: 'error:' + context,
    p_entity_type: 'error',
    p_entity_label: msg.slice(0, 200),
    p_metadata: { context, message: msg, timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.pathname : null },
  }).then(() => {}, () => {});
};

export const logWarning = (context: string, message: unknown): void => {
  const msg = sanitize(message);
  if (isDev) console.warn('[WARN] ' + context + ':', message);

  captureMessage(`[${context}] ${msg.slice(0, 200)}`, { context });

  supabase.rpc('log_activity', {
    p_action: 'warning:' + context,
    p_entity_type: 'warning',
    p_entity_label: msg.slice(0, 200),
    p_metadata: { context, message: msg, timestamp: new Date().toISOString() },
  }).then(() => {}, () => {});
};

export const logDebug = (context: string, data: unknown): void => {
  if (isDev) console.debug('[DEBUG] ' + context + ':', data);
};

export const logAudit = (params: {
  action: string; entityType?: string; entityId?: string;
  entityLabel?: string; managerId?: string; propertyId?: string;
  metadata?: Record<string, unknown>;
}): void => {
  supabase.rpc('log_activity', {
    p_action: params.action,
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
    p_entity_label: params.entityLabel ?? null,
    p_manager_id: params.managerId ?? null,
    p_property_id: params.propertyId ?? null,
    p_metadata: params.metadata ?? null,
  }).then(() => {}, () => {});
};

export const initGlobalErrorCatcher = (): void => {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => logError('window.onerror', { message: e.message, filename: e.filename, lineno: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => logError('unhandledRejection', e.reason));
};
