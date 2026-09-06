/**
 * Secret masking for any textual log or configuration value surfaced on the
 * platform admin desk. Never let a credential reach the screen.
 */

const SECRET_KEY_PATTERN = /password|secret|token|api[_-]?key|service[_-]?role|private[_-]?key|authorization|cookie/i;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export const REDACTED = "[redacted]" as const;

/** Redact values for known secret-shaped keys in a flat metadata object. */
export function maskSecrets(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    out[k] = isSecretKey(k) ? REDACTED : v;
  }
  return out;
}

/** Safe, deterministic serialization of log metadata with secrets redacted. */
export function stringifyMasked(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return "{}";
  try {
    return JSON.stringify(maskSecrets(metadata), null, 2);
  } catch {
    return "{}";
  }
}
