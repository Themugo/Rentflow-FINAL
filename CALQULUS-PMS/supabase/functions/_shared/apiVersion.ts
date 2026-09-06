/**
 * _shared/apiVersion.ts
 *
 * API versioning middleware for CALQULUS RMS edge functions.
 *
 * Why versioning?
 *   As the platform grows, breaking changes to edge function request/response
 *   formats will be unavoidable. Rather than silently breaking existing
 *   clients (mobile apps, third-party integrations, older web versions),
 *   each function declares which API version it implements and rejects
 *   requests from clients that specify an incompatible version.
 *
 * How it works:
 *   1. Clients send `X-API-Version: YYYY-MM-DD` header (e.g. "2026-05-19").
 *   2. Each function declares its supported version via `API_VERSION`.
 *   3. If the client version is older than the function's minimum supported
 *      version, a 426 Upgrade Required response is returned.
 *   4. If no version header is sent, the request is allowed (backward compat).
 *
 * Usage:
 *   import { checkApiVersion, apiVersionResponse } from "../_shared/apiVersion.ts";
 *
 *   const API_VERSION = "2026-05-19";
 *
 *   serve(async (req) => {
 *     const versionCheck = checkApiVersion(req, API_VERSION);
 *     if (versionCheck) return versionCheck;
 *
 *     // ... handler logic ...
 *   });
 */

import { getCorsHeaders } from "./cors.ts";

/**
 * Current API version for all CALQULUS RMS edge functions.
 * Update this when making breaking changes to request/response formats.
 * Format: YYYY-MM-DD
 */
export const CURRENT_API_VERSION = "2026-05-19";

/**
 * Minimum supported client API version.
 * Requests from clients older than this will be rejected with a 426.
 */
export const MIN_SUPPORTED_VERSION = "2026-01-01";

/**
 * Parse an API version string and return a comparable date string.
 * Returns null if the format is invalid.
 */
export function parseApiVersion(version: string): string | null {
  const match = version.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (y < 2020 || y > 2030 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Check if a client's API version is compatible with the function's version.
 *
 * Returns a Response object if the version is incompatible (caller should
 * return this immediately). Returns null if the version is compatible.
 *
 * Rules:
 *   - No version header → allowed (backward compatibility)
 *   - Invalid version format → 400 Bad Request
 *   - Version older than MIN_SUPPORTED_VERSION → 426 Upgrade Required
 *   - Version >= MIN_SUPPORTED_VERSION → allowed (null)
 */
export function checkApiVersion(
  req: Request,
  functionVersion: string = CURRENT_API_VERSION,
): Response | null {
  const clientVersion = req.headers.get("X-API-Version");

  // No version header — allow for backward compatibility
  if (!clientVersion) return null;

  const parsed = parseApiVersion(clientVersion);
  if (!parsed) {
    return new Response(
      JSON.stringify({
        error: "Invalid API version format. Use YYYY-MM-DD (e.g. 2026-05-19).",
        code: "INVALID_API_VERSION",
        currentVersion: functionVersion,
      }),
      {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
          "X-API-Version": functionVersion,
        },
      },
    );
  }

  // Check against minimum supported version
  if (parsed < MIN_SUPPORTED_VERSION) {
    return new Response(
      JSON.stringify({
        error: `API version ${clientVersion} is no longer supported. Minimum supported version is ${MIN_SUPPORTED_VERSION}.`,
        code: "API_VERSION_DEPRECATED",
        currentVersion: functionVersion,
        minSupportedVersion: MIN_SUPPORTED_VERSION,
        upgradeUrl: "https://docs.calqulus.site/api/versioning",
      }),
      {
        status: 426,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
          "X-API-Version": functionVersion,
          "Retry-After": "0",
        },
      },
    );
  }

  // Version is compatible
  return null;
}

/**
 * Add API version headers to a successful response.
 */
export function withApiVersion(
  response: Response,
  version: string = CURRENT_API_VERSION,
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-API-Version", version);
  headers.set("X-API-Min-Supported", MIN_SUPPORTED_VERSION);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
