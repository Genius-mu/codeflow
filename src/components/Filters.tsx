import { useEffect, useMemo, useRef, useState } from "react";
import { Star, GitFork, X, SlidersHorizontal } from "lucide-react";
import { useAppStore, selectIsFiltering } from "../lib/store";
import { getUniqueLanguages } from "../lib/utils";
import type { GitHubRepo } from "../lib/schemas";

interface FiltersProps {
  repos: GitHubRepo[];
}

export function Filters({ repos }: FiltersProps) {
  const filters = useAppStore((s) => s.filters);
  const toggleLanguage = useAppStore((s) => s.toggleLanguage);
  const setMinStars = useAppStore((s) => s.setMinStars);
  const setIncludeForks = useAppStore((s) => s.setIncludeForks);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const isFiltering = useAppStore(selectIsFiltering);

  // Derive language options from the actual repos — only show languages that exist.
  const availableLanguages = useMemo(() => getUniqueLanguages(repos), [repos]);

  /**
   * Local slider value — debounces store updates so dragging the slider
   * doesn't fire 50+ re-renders. The visible thumb position updates instantly
   * (good UX), but the store + downstream charts only update when the user
   * pauses for 150ms.
   */
  const [localStars, setLocalStars] = useState(filters.minStars);
  const debounceRef = useRef<number | null>(null);

  // Keep local in sync if filters reset from elsewhere
  useEffect(() => {
    setLocalStars(filters.minStars);
  }, [filters.minStars]);

  function handleSliderChange(value: number) {
    setLocalStars(value); // instant visual feedback

    // Cancel any pending commit and schedule a new one
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setMinStars(value);
    }, 150);
  }

  // Cleanup on unmount — prevents stray timer firing after component is gone
  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  if (repos.length === 0) return null;

  return (
    <section className="card p-5 sm:p-6 animate-slide-up" aria-label="Filters">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            className="w-4 h-4 text-text-muted"
            strokeWidth={2.25}
          />
          <h3 className="font-display font-semibold text-base text-text-primary">
            Filters
          </h3>
          {isFiltering && (
            <span
              className="
                px-2 py-0.5 rounded-full
                bg-accent/15 text-accent
                text-[10px] font-mono uppercase tracking-wider
                animate-fade-in
              "
            >
              Active
            </span>
          )}
        </div>
        {isFiltering && (
          <button
            onClick={resetFilters}
            className="
              flex items-center gap-1.5
              text-xs text-text-secondary hover:text-text-primary
              transition-colors duration-200
              group
            "
          >
            <X className="w-3.5 h-3.5 transition-transform group-hover:rotate-90 duration-200" />
            Reset
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Languages — chip multi-select */}
        {availableLanguages.length > 0 && (
          <div>
            <label className="block text-xs uppercase tracking-wider font-medium text-text-muted mb-2.5">
              Languages
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableLanguages.map((lang) => {
                const active = filters.languages.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium font-mono
                      transition-all duration-200
                      active:scale-95
                      ${
                        active
                          ? "bg-accent text-bg-base shadow-[0_0_12px_rgba(163,230,53,0.3)]"
                          : "bg-bg-elevated text-text-secondary border border-bg-border hover:text-text-primary hover:border-text-muted"
                      }
                    `}
                    aria-pressed={active}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Min stars — debounced range slider */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label
              htmlFor="min-stars"
              className="text-xs uppercase tracking-wider font-medium text-text-muted flex items-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5" strokeWidth={2.25} />
              Minimum stars
            </label>
            <span className="font-mono text-sm font-semibold text-accent tabular-nums">
              {localStars}
              {localStars >= 1000 && "+"}
            </span>
          </div>
          <input
            id="min-stars"
            type="range"
            min={0}
            max={1000}
            step={10}
            value={localStars}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="lime-range w-full"
          />
          <div className="flex justify-between mt-1 text-[10px] font-mono text-text-muted">
            <span>0</span>
            <span>500</span>
            <span>1K+</span>
          </div>
        </div>

        {/* Include forks — toggle switch */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <GitFork
              className="w-3.5 h-3.5 text-text-muted"
              strokeWidth={2.25}
            />
            <span className="text-sm text-text-primary">Include forks</span>
          </div>
          <button
            type="button"
            onClick={() => setIncludeForks(!filters.includeForks)}
            role="switch"
            aria-checked={filters.includeForks}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full
              transition-colors duration-300
              focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-bg-surface
              ${filters.includeForks ? "bg-accent" : "bg-bg-elevated border border-bg-border"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full
                transition-transform duration-300 ease-out
                ${
                  filters.includeForks
                    ? "translate-x-6 bg-bg-base shadow-md"
                    : "translate-x-1 bg-text-muted"
                }
              `}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
