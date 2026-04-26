import { create } from "zustand";

export type Theme = "dark" | "light";

const STORAGE_KEY = "codeflow-theme";

/**
 * Determine the theme that should apply on first load.
 * Priority: explicit user choice (localStorage) > system preference > dark.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "dark" || stored === "light") return stored;

  // Honor OS-level "prefers-color-scheme" if no explicit choice
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

/**
 * Apply theme to <html> by toggling the .light class.
 * Called from the store on every change so DOM stays in sync.
 */
function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
  // For native form controls + scrollbars
  document.documentElement.style.colorScheme = theme;
}

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  const initial = getInitialTheme();
  // Apply immediately on store creation so the first paint matches
  applyTheme(initial);

  return {
    theme: initial,
    setTheme: (theme) => {
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
      set({ theme });
    },
    toggleTheme: () => {
      const next: Theme = get().theme === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      set({ theme: next });
    },
  };
});
