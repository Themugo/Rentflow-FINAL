import { useCallback, useEffect, useRef, useState } from "react";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/shared/lib/formDraft";

/**
 * Persists an in-progress onboarding field to sessionStorage so a refresh
 * or accidental close does not lose unsubmitted input. Keyed per user so
 * drafts never leak between accounts on a shared browser. Session-scoped
 * (not localStorage) so drafts disappear when the tab closes for good.
 *
 * Returns [value, setValue, clearDraft]. Call clearDraft after a successful
 * submit so a stale draft is not restored over saved state.
 */
export function useOnboardingDraft(
  field: string,
  userId: string | null,
): [string, (value: string) => void, () => void] {
  const key = userId ? `onboarding:${userId}:${field}` : null;
  const [value, setValue] = useState("");
  const loadedForKey = useRef<string | null>(null);

  useEffect(() => {
    if (!key || loadedForKey.current === key) return;
    loadedForKey.current = key;
    const draft = loadFormDraft<string>(key);
    if (typeof draft === "string" && draft) setValue(draft);
  }, [key]);

  const setDraftValue = useCallback(
    (next: string | ((prev: string) => string)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (key) saveFormDraft(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    if (key) clearFormDraft(key);
  }, [key]);

  return [value, setDraftValue, clearDraft];
}
