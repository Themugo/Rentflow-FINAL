/**
 * Sentry wrapper — lazy, optional with production tracing.
 *
 * Sentry is only initialized when VITE_SENTRY_DSN is set at build time.
 * If it is not set, every export below becomes a no-op so the app runs
 * fine without it (useful for local dev and for the open-source build).
 *
 * Why lazy import? Sentry's browser bundle is ~50KB gzipped. Only load it
 * when there is a DSN to send to — and even then, load it AFTER first
 * paint so it never blocks initial render.
 *
 * To enable in production:
 *   1. Add `VITE_SENTRY_DSN=https://xxx@sentry.io/yyy` to env
 *   2. Add `*.sentry.io` to CSP connect-src (already done in vercel.json)
 *   3. Configure sentry-cli to upload source maps after `vite build` —
 *      see PRODUCTION_CHECKLIST.md for the recommended GitHub Actions step.
 *
 * If you'd rather use a different provider (Datadog, Rollbar, Highlight),
 * swap the implementation in `init()` and `captureException()`; the rest
 * of the app talks to this wrapper only.
 */

type SentryModule = typeof import("@sentry/browser");

let sentry: SentryModule | null = null;
let initPromise: Promise<void> | null = null;

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment = (import.meta.env.VITE_SENTRY_ENV as string | undefined)
  ?? (import.meta.env.PROD ? "production" : "development");
const release = import.meta.env.VITE_APP_VERSION as string | undefined;

export function initSentry(): Promise<void> {
  if (!dsn) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mod = await import(/* @vite-ignore */ "@sentry/browser");
      sentry = mod;
      
      mod.init({
        dsn,
        environment,
        release,
        
        // Performance monitoring
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/www\.calqulus\.site/,
        ],
        
        // Session replay
        replaysSessionSampleRate: 0.1, // 10% of sessions for replay
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors for replay
        
        // Strip query strings and most PII before sending. CALQULUS PMS handles
        // tenant phone numbers and email addresses — keep them out of error
        // reports unless absolutely necessary for debugging.
        beforeSend(event) {
          if (event.request?.url) {
            try {
              const u = new URL(event.request.url);
              u.search = "";
              event.request.url = u.toString();
            } catch { /* leave as-is */ }
          }
          
          // Add custom context for payment failures
          if (event.tags?.category === 'payment') {
            event.contexts = {
              ...event.contexts,
              payment: {
                ...event.contexts?.payment,
                timestamp: new Date().toISOString(),
              },
            };
          }
          
          // Add custom context for suspicious logins
          if (event.tags?.category === 'security') {
            event.contexts = {
              ...event.contexts,
              security: {
                ...event.contexts?.security,
                timestamp: new Date().toISOString(),
              },
            };
          }
          
          delete event.user;
          return event;
        },
        
        // Custom error classification
        beforeSendTransaction(event) {
          // Filter out health check transactions
          if (event.transaction?.includes('/health')) {
            return null;
          }
          return event;
        },
      });
      
      console.warn('Sentry initialized with production tracing enabled');
    } catch (err) {
      console.warn("Sentry init failed (continuing without):", err);
    }
  })();

  return initPromise;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureException(error, { extra: context });
  } catch { /* ignore */ }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(message, { extra: context });
  } catch { /* ignore */ }
}

// Payment failure tracking
export function trackPaymentFailure(
  paymentId: string,
  amount: number,
  method: string,
  error: string
): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(`Payment failed: ${paymentId}`, {
      level: 'error',
      tags: {
        category: 'payment',
        payment_id: paymentId,
        payment_method: method,
      },
      extra: {
        amount,
        error,
        timestamp: new Date().toISOString(),
      },
    });
  } catch { /* ignore */ }
}

// Suspicious login tracking
export function trackSuspiciousLogin(
  userId: string,
  ip: string,
  userAgent: string,
  reason: string
): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(`Suspicious login attempt: ${userId}`, {
      level: 'warning',
      tags: {
        category: 'security',
        user_id: userId,
        ip_address: ip,
      },
      extra: {
        user_agent: userAgent,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  } catch { /* ignore */ }
}

// Callback failure tracking
export function trackCallbackFailure(
  provider: string,
  transactionId: string,
  error: string,
  retryCount: number
): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(`Callback failed: ${provider}`, {
      level: 'error',
      tags: {
        category: 'payment',
        provider,
        transaction_id: transactionId,
      },
      extra: {
        error,
        retry_count: retryCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch { /* ignore */ }
}

// Database anomaly tracking
export function trackDatabaseAnomaly(
  queryType: string,
  duration: number,
  threshold: number
): void {
  if (!sentry) return;
  try {
    sentry.captureMessage(`Database anomaly detected: ${queryType}`, {
      level: 'warning',
      tags: {
        category: 'database',
        query_type: queryType,
      },
      extra: {
        duration_ms: duration,
        threshold_ms: threshold,
        timestamp: new Date().toISOString(),
      },
    });
  } catch { /* ignore */ }
}

// Start a performance transaction
export function startTransaction(name: string, op: string) {
  if (!sentry) return null;
  try {
    // Use the correct Sentry API for starting transactions
    const transaction = sentry.startInactiveSpan({
      op,
      name,
    });
    return transaction;
  } catch { /* ignore */ }
  return null;
}

export const isSentryEnabled = Boolean(dsn);
