import { isHexColor } from "./hex";

const CSS_INJECTION = /<style|<\/style|expression\s*\(|javascript:|vbscript:|data:text\/html|[{}]/i;

export function containsCssInjection(value: string): boolean {
  return CSS_INJECTION.test(value);
}

/** Named text fields only — never a CSS or HTML dump. */
export function sanitizePlainText(value: string, maxLength = 160): string {
  const stripped = value.replace(/<[^>]*>/g, "").replace(/[{}\\]/g, "").trim();
  return stripped.slice(0, maxLength);
}

/**
 * Allow relative paths and https URLs used for logo/favicon.
 * Reject protocol-relative, javascript, data, and CSS payloads.
 */
export function sanitizeBrandUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (containsCssInjection(trimmed)) return "";
  if (trimmed.startsWith("/")) {
    return trimmed.slice(0, 500);
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.username || url.password) return "";
    return url.toString().slice(0, 500);
  } catch {
    return "";
  }
}

/** Host only. DNS/TLS are not provisioned from Brand Studio. */
export function sanitizeCustomDomain(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!trimmed) return "";
  if (containsCssInjection(trimmed)) return "";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(trimmed)) {
    return "";
  }
  return trimmed.slice(0, 253);
}

export function sanitizeOptionalHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return isHexColor(trimmed) ? trimmed.toUpperCase() : "";
}
