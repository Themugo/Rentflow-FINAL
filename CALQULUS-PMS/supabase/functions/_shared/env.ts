/**
 * _shared/env.ts
 *
 * Strict environment-variable access for edge functions.
 *
 * Problem this solves:
 *   Every edge function reads its secrets with `Deno.env.get("FOO")!`. The
 *   non-null assertion (`!`) lies to the type checker — if the secret is
 *   missing the value is `undefined` and the function only crashes when
 *   that value is actually USED, deep inside a handler, with an opaque
 *   message like "Cannot read property 'replace' of undefined".
 *
 *   With `requireEnv("FOO")` we fail FAST at module load with a clear
 *   message naming the missing variable. Supabase will surface this in
 *   the function logs immediately rather than after a request comes in.
 *
 * Usage:
 *   import { requireEnv, getEnv } from "../_shared/env.ts";
 *
 *   const SUPABASE_URL = requireEnv("SUPABASE_URL");
 *   const RESEND_KEY   = getEnv("RESEND_API_KEY");  // optional, may be ""
 *
 * `requireEnv` throws on missing or empty; `getEnv` returns "" if missing.
 */

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
      `Set it in Supabase Dashboard → Edge Functions → Secrets.`,
    );
  }
  return value;
}

export function getEnv(name: string, fallback = ""): string {
  const value = Deno.env.get(name);
  return value && value.trim() !== "" ? value : fallback;
}

/**
 * Verify multiple required env vars at once. Useful at the top of a function
 * module so the deploy log shows ALL missing secrets, not just the first.
 */
export function requireEnvs(names: string[]): Record<string, string> {
  const missing: string[] = [];
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = Deno.env.get(n);
    if (!v || v.trim() === "") missing.push(n);
    else out[n] = v;
  }
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missing.join(", ")}. ` +
      `Set them in Supabase Dashboard → Edge Functions → Secrets.`,
    );
  }
  return out;
}
