const PREFIX = "calqulus-form-draft:";

export function loadFormDraft<T>(key: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveFormDraft(key: string, value: unknown): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota or private mode — drafts are best-effort.
  }
}

export function clearFormDraft(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
