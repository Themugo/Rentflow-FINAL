import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children, defaultTheme = "system" }: { children: ReactNode; defaultTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored =
        (localStorage.getItem("calqulus-pms-theme") as Theme | null) ||
        (localStorage.getItem("calqulusrms-theme") as Theme | null);
      return stored ?? defaultTheme;
    }
    catch { return defaultTheme; }
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;

    // Dark mode is classified dormant. Production always uses the light token set.
    root.classList.remove("dark");
    setResolvedTheme("light");

    // Keep the media listener so the toggle UI can still reflect the user's
    // system preference metadata without changing the visual theme.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { /* no-op: theme stays light */ };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("calqulus-pms-theme", t); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
