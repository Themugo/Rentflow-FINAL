/**
 * _shared/cors.ts
 *
 * Centralised CORS configuration for all CALQULUS PMS edge functions.
 *
 * In production, restrict to the canonical CALQULUS PMS domain.
 * During local development, Supabase CLI uses localhost.
 *
 * Why not wildcard (*)?
 *   With a wildcard origin any website can call these functions using
 *   a stolen/leaked user JWT — a CSRF vector for sensitive operations
 *   like recording payments or initiating STK pushes.
 *   Restricting to known origins means a cross-origin request from
 *   an attacker's page is rejected at the preflight stage.
 */

const ALLOWED_ORIGINS = [
  "https://calqulus.site",
  "https://www.calqulus.site",
  "https://app.calqulus.site",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:53306",
  "http://localhost:3000",
  "http://localhost:8080",
];

/**
 * Build CORS headers for a given request Origin.
 * If the origin is in the allowlist, reflects it back (required for cookies/credentials).
 * Otherwise falls back to the primary production domain.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin":      allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-bank-signature, x-webhook-secret",
    "Access-Control-Allow-Methods":     "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

/**
 * Standard preflight response for OPTIONS requests.
 */
export function preflightResponse(req: Request): Response {
  return new Response(null, { headers: getCorsHeaders(req) });
}
