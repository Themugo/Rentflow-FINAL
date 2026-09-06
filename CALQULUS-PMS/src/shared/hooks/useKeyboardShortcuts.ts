import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function useKeyboardShortcuts(onOpenCommandPalette?: () => void) {
  const navigate = useNavigate();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [keySequence, setKeySequence] = useState<string[]>([]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+K / Ctrl+K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // Help modal on '?'
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // Multi-key sequences (e.g., 'g' then 'd')
      const currentKey = e.key.toLowerCase();
      
      if (keySequence.length === 0 && currentKey === "g") {
        setKeySequence(["g"]);
        timeoutId = setTimeout(() => setKeySequence([]), 1500);
        return;
      }

      if (keySequence[0] === "g") {
        setKeySequence([]);
        clearTimeout(timeoutId);

        switch (currentKey) {
          case "d":
            navigate("/");
            break;
          case "l":
            navigate("/leases");
            break;
          case "t":
            navigate("/tenants");
            break;
          case "b":
            navigate("/billing");
            break;
          case "w":
            navigate("/water-billing");
            break;
          case "m":
            navigate("/maintenance");
            break;
          case "r":
            navigate("/reports");
            break;
          case "s":
            navigate("/settings");
            break;
          case "a":
            navigate("/agency");
            break;
          case "o":
            navigate("/webhost");
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [keySequence, navigate, onOpenCommandPalette]);

  return {
    showShortcutsModal,
    setShowShortcutsModal,
    keySequence,
  };
}
