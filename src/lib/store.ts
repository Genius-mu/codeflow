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
 * Single global store.
 * Components subscribe with selectors:
 *   const username = useAppStore(s => s.username)
 * Only that slice causes re-renders, not the whole store.
 */
export const useAppStore = create<AppState>((set) => ({
  // Search
  username: "",
  setUsername: (username) => set({ username: username.trim() }),

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
 * Derived selector — returns true if any filter is active.
 * Used to show a badge/indicator on the filters button.
 *
 * Defined as a separate function (not a hook here) so it can be reused
 * with shallow comparison if needed later.
 */
export const selectIsFiltering = (state: AppState): boolean =>
  state.filters.languages.length > 0 ||
  state.filters.minStars > 0 ||
  state.filters.includeForks;
