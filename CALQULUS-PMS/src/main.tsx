import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorCatcher } from "@/shared/lib/errorLogger";
import { initSentry } from "@/shared/lib/sentry";
import { initObservability } from "@/shared/lib/observability";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { ProductionDiagnostics } from "@/shared/components/ProductionDiagnostics";

// Catch all unhandled errors and log them to Supabase activity_logs.
// View errors: SELECT * FROM activity_logs WHERE action LIKE 'error:%' ORDER BY created_at DESC;
initGlobalErrorCatcher();

// Lazy-init Sentry — fire-and-forget. Sentry only loads if VITE_SENTRY_DSN
// is set at build time; otherwise this resolves immediately to a no-op.
// We deliberately do NOT await it so it never blocks first paint.
initSentry();

// Web Vitals (LCP, INP, CLS, TTFB) + session correlation. Never blocks paint.
initObservability();

const rootEl = document.getElementById("root")!;

createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      {/* Production diagnostics panel - visible via Ctrl+Shift+D */}
      <ProductionDiagnostics />
    </ErrorBoundary>
  </React.StrictMode>
);
