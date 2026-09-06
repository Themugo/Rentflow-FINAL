import type { KeyboardEvent } from "react";

/**
 * Mirrors a click handler onto Enter/Space for elements that use `onClick`
 * on a non-native-interactive element (e.g. a `<div role="button">` list
 * row). Pass alongside `role="button" tabIndex={0}` so the same action is
 * reachable via keyboard, not just mouse/touch.
 */
export function onActivateKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}
