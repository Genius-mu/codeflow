import { create } from "zustand";

export interface Filters {
  /** Languages to include. Empty array = include all. */
  languages: string[];
  /** Minimum star count to include a repo. */
  minStars: number;
  /** Whether to include forked repos. */
  includeForks: boolean;
}

interface AppState {
  // Search — single and compare modes
  username: string;
  usernameB: string;
  compareMode: boolean;

  setUsername: (username: string) => void;
  setUsernameB: (username: string) => void;
  enterCompareMode: (b: string) => void;
  exitCompareMode: () => void;

  // Filters
  filters: Filters;
  setLanguages: (languages: string[]) => void;
  toggleLanguage: (language: string) => void;
  setMinStars: (minStars: number) => void;
  setIncludeForks: (includeForks: boolean) => void;
  setFilters: (partial: Partial<Filters>) => void;
  resetFilters: () => void;

  // UI
  isFiltersOpen: boolean;
  toggleFilters: () => void;
}

const DEFAULT_FILTERS: Filters = {
  languages: [],
  minStars: 0,
  includeForks: true,
};

/**
 * Read state from the URL on initial load.
 * Supports two URL shapes:
 *   /?user=X         → single mode, viewing X
 *   /?a=X&b=Y        → compare mode, viewing X vs Y
 *
 * If both shapes are present, compare wins (it's more specific).
 */
function readInitial(): {
  username: string;
  usernameB: string;
  compareMode: boolean;
} {
  if (typeof window === "undefined") {
    return { username: "", usernameB: "", compareMode: false };
  }
  const params = new URLSearchParams(window.location.search);
  const a = params.get("a")?.trim() ?? "";
  const b = params.get("b")?.trim() ?? "";
  const single = params.get("user")?.trim() ?? "";

  if (a && b) {
    return { username: a, usernameB: b, compareMode: true };
  }
  return { username: single || a, usernameB: "", compareMode: false };
}

/**
 * Push the current state into the URL.
 * Uses `replaceState` so we don't pollute browser history on every keystroke.
 */
function writeURL(username: string, usernameB: string, compareMode: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("user");
  url.searchParams.delete("a");
  url.searchParams.delete("b");

  if (compareMode && username && usernameB) {
    url.searchParams.set("a", username);
    url.searchParams.set("b", usernameB);
  } else if (username) {
    url.searchParams.set("user", username);
  }

  history.replaceState({}, "", url.toString());
}

const initial = readInitial();

export const useAppStore = create<AppState>((set, get) => ({
  username: initial.username,
  usernameB: initial.usernameB,
  compareMode: initial.compareMode,
  filters: DEFAULT_FILTERS,
  isFiltersOpen: false,

  setUsername: (username) => {
    const clean = username.trim();
    const { usernameB, compareMode } = get();
    set({ username: clean });
    writeURL(clean, usernameB, compareMode);
  },

  setUsernameB: (username) => {
    const clean = username.trim();
    const { username: a, compareMode } = get();
    set({ usernameB: clean });
    writeURL(a, clean, compareMode);
  },

  enterCompareMode: (b) => {
    const clean = b.trim();
    const { username } = get();
    set({ usernameB: clean, compareMode: true });
    writeURL(username, clean, true);
  },

  exitCompareMode: () => {
    const { username } = get();
    set({ usernameB: "", compareMode: false });
    writeURL(username, "", false);
  },

  // Filters
  setLanguages: (languages) =>
    set((s) => ({ filters: { ...s.filters, languages } })),

  toggleLanguage: (language) =>
    set((s) => {
      const current = s.filters.languages;
      const next = current.includes(language)
        ? current.filter((l) => l !== language)
        : [...current, language];
      return { filters: { ...s.filters, languages: next } };
    }),

  setMinStars: (minStars) =>
    set((s) => ({ filters: { ...s.filters, minStars } })),

  setIncludeForks: (includeForks) =>
    set((s) => ({ filters: { ...s.filters, includeForks } })),

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  // UI
  toggleFilters: () => set((s) => ({ isFiltersOpen: !s.isFiltersOpen })),
}));

/**
 * Sync the store back from the URL when the user uses browser back/forward.
 */
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const next = readInitial();
    useAppStore.setState({
      username: next.username,
      usernameB: next.usernameB,
      compareMode: next.compareMode,
    });
  });
}

/**
 * Derived selector — true if any non-default filter is active.
 * Used by Filters.tsx to show the "Active" badge and Reset button.
 */
export const selectIsFiltering = (s: AppState): boolean =>
  s.filters.languages.length > 0 ||
  s.filters.minStars > 0 ||
  !s.filters.includeForks;
