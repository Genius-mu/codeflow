import { create } from "zustand";

/**
 * Filter state shape.
 * - languages: empty array means "all languages" (no filter active)
 * - minStars: 0 means "no minimum" (no filter active)
 * Keeping these as "empty = inactive" lets us check `isFiltering` cheaply.
 */
export interface Filters {
  languages: string[];
  minStars: number;
  includeForks: boolean;
}

interface AppState {
  // Search
  username: string;
  setUsername: (username: string) => void;

  // Filters
  filters: Filters;
  setLanguages: (languages: string[]) => void;
  toggleLanguage: (language: string) => void;
  setMinStars: (minStars: number) => void;
  setIncludeForks: (includeForks: boolean) => void;
  resetFilters: () => void;

  // UI
  isFiltersOpen: boolean;
  toggleFilters: () => void;
}

const DEFAULT_FILTERS: Filters = {
  languages: [],
  minStars: 0,
  includeForks: false,
};

/**
 * Read the initial username from ?user= in the URL.
 * Runs once at module load. Falls back to empty string.
 */
function readUsernameFromURL(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("user") ?? "").trim();
}

/**
 * Sync username back to the URL without triggering a navigation.
 * - replaceState (not pushState) → doesn't pollute browser history with every search
 * - Empty username → remove the ?user= param entirely (clean URLs)
 */
function syncUsernameToURL(username: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (username) {
    url.searchParams.set("user", username);
  } else {
    url.searchParams.delete("user");
  }
  window.history.replaceState({}, "", url.toString());
}

/**
 * Single global store.
 * Components subscribe with selectors:
 *   const username = useAppStore(s => s.username)
 * Only that slice causes re-renders, not the whole store.
 */
export const useAppStore = create<AppState>((set) => ({
  // Search — initial value pulled from URL
  username: readUsernameFromURL(),
  setUsername: (username) => {
    const trimmed = username.trim();
    syncUsernameToURL(trimmed);
    set({ username: trimmed });
  },

  // Filters
  filters: DEFAULT_FILTERS,
  setLanguages: (languages) =>
    set((state) => ({ filters: { ...state.filters, languages } })),

  toggleLanguage: (language) =>
    set((state) => {
      const current = state.filters.languages;
      const next = current.includes(language)
        ? current.filter((l) => l !== language)
        : [...current, language];
      return { filters: { ...state.filters, languages: next } };
    }),

  setMinStars: (minStars) =>
    set((state) => ({ filters: { ...state.filters, minStars } })),

  setIncludeForks: (includeForks) =>
    set((state) => ({ filters: { ...state.filters, includeForks } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  // UI
  isFiltersOpen: false,
  toggleFilters: () =>
    set((state) => ({ isFiltersOpen: !state.isFiltersOpen })),
}));

/**
 * Listen for browser back/forward navigation and sync the store.
 * Without this, hitting Back wouldn't update the dashboard.
 */
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const username = readUsernameFromURL();
    useAppStore.setState({ username });
  });
}

/**
 * Derived selector — returns true if any filter is active.
 * Used to show a badge/indicator on the filters button.
 */
export const selectIsFiltering = (state: AppState): boolean =>
  state.filters.languages.length > 0 ||
  state.filters.minStars > 0 ||
  state.filters.includeForks;
