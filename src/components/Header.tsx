import { useState, useEffect, type FormEvent } from "react";
import { Search, Code2, Loader2, Sun, Moon, GitCompare, X } from "lucide-react";
import { useAppStore } from "../lib/store";
import { useThemeStore } from "../lib/theme";
import { AuthControls } from "./AuthControls";

interface HeaderProps {
  isLoading?: boolean;
}

export function Header({ isLoading = false }: HeaderProps) {
  const username = useAppStore((s) => s.username);
  const usernameB = useAppStore((s) => s.usernameB);
  const compareMode = useAppStore((s) => s.compareMode);
  const setUsername = useAppStore((s) => s.setUsername);
  const setUsernameB = useAppStore((s) => s.setUsernameB);
  const enterCompareMode = useAppStore((s) => s.enterCompareMode);
  const exitCompareMode = useAppStore((s) => s.exitCompareMode);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [inputA, setInputA] = useState(username);
  const [inputB, setInputB] = useState(usernameB);

  useEffect(() => setInputA(username), [username]);
  useEffect(() => setInputB(usernameB), [usernameB]);

  function handleSubmitA(e: FormEvent) {
    e.preventDefault();
    const trimmed = inputA.trim();
    if (!trimmed || trimmed === username) return;
    setUsername(trimmed);
  }

  function handleSubmitB(e: FormEvent) {
    e.preventDefault();
    const trimmed = inputB.trim();
    if (!trimmed || trimmed === usernameB) return;
    setUsernameB(trimmed);
  }

  function handleToggleCompare() {
    if (compareMode) {
      exitCompareMode();
      setInputB("");
    } else {
      // Enter compare mode with an empty B — user fills it in
      enterCompareMode("");
    }
  }

  return (
    <header className="sticky top-0 z-30 glass">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-2 sm:gap-3">
          {/* Brand */}
          <a
            href="/"
            className="flex items-center gap-2 shrink-0 group"
            aria-label="CodeFlow home"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10 ring-1 ring-accent/30 transition-transform group-hover:scale-105">
              <Code2 className="w-5 h-5 text-accent" strokeWidth={2.25} />
            </div>
            <span
              className="brand-mark text-xl sm:text-2xl text-text-primary hidden sm:inline"
              aria-hidden="true"
            >
              Code<span className="text-accent">Flow</span>
            </span>
          </a>

          {/* Primary search (User A) */}
          <form
            onSubmit={handleSubmitA}
            className="flex-1 min-w-0 group"
            role="search"
          >
            <div className="relative">
              <input
                type="text"
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                placeholder={compareMode ? "User A…" : "Search a GitHub user…"}
                spellCheck={false}
                autoComplete="off"
                disabled={isLoading}
                className="
                  w-full pl-3 pr-11 py-2.5 rounded-lg
                  bg-bg-surface border border-bg-border
                  text-sm text-text-primary placeholder:text-text-muted
                  font-mono
                  outline-none transition-all duration-200
                  focus:border-accent/50 focus:bg-bg-elevated
                  focus:ring-2 focus:ring-accent/20
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
                aria-label="GitHub username"
              />
              <button
                type="submit"
                disabled={isLoading || !inputA.trim()}
                aria-label="Search"
                title="Search"
                className="
                  absolute right-1.5 top-1/2 -translate-y-1/2
                  w-8 h-8 rounded-md
                  bg-accent text-bg-base
                  flex items-center justify-center
                  transition-all duration-200
                  hover:bg-accent-hover hover:shadow-[0_0_12px_var(--accent-glow-strong)]
                  active:scale-90
                  disabled:opacity-40 disabled:cursor-not-allowed
                  disabled:hover:shadow-none disabled:active:scale-100
                "
              >
                {isLoading ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    strokeWidth={2.25}
                  />
                ) : (
                  <Search className="w-4 h-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </form>

          {/* Right cluster: compare toggle, auth, theme */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleCompare}
              aria-label={
                compareMode ? "Exit compare mode" : "Enter compare mode"
              }
              title={compareMode ? "Exit compare mode" : "Compare two users"}
              className={`
                shrink-0 w-9 h-9 rounded-lg
                flex items-center justify-center
                border transition-all duration-200
                active:scale-90
                focus:outline-none focus:ring-2 focus:ring-accent/40
                ${
                  compareMode
                    ? "bg-accent text-bg-base border-accent shadow-[0_0_12px_var(--accent-glow-medium)]"
                    : "bg-bg-surface border-bg-border text-text-secondary hover:text-accent hover:border-accent/40 hover:bg-accent/5"
                }
              `}
            >
              {compareMode ? (
                <X className="w-4 h-4" strokeWidth={2.5} />
              ) : (
                <GitCompare className="w-4 h-4" strokeWidth={2.25} />
              )}
            </button>

            <AuthControls />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="
                relative shrink-0
                w-9 h-9 rounded-lg
                flex items-center justify-center
                bg-bg-surface border border-bg-border text-text-secondary
                transition-all duration-200
                hover:text-accent hover:border-accent/40 hover:bg-accent/5
                active:scale-90
                focus:outline-none focus:ring-2 focus:ring-accent/40
                overflow-hidden
              "
            >
              <Sun
                className={`
                  absolute w-4 h-4
                  transition-all duration-300 ease-out
                  ${
                    theme === "dark"
                      ? "opacity-100 rotate-0 scale-100"
                      : "opacity-0 rotate-90 scale-50"
                  }
                `}
                strokeWidth={2.25}
              />
              <Moon
                className={`
                  absolute w-4 h-4
                  transition-all duration-300 ease-out
                  ${
                    theme === "light"
                      ? "opacity-100 rotate-0 scale-100"
                      : "opacity-0 -rotate-90 scale-50"
                  }
                `}
                strokeWidth={2.25}
              />
            </button>
          </div>
        </div>

        {/* Secondary search (User B) — only in compare mode */}
        {compareMode && (
          <div className="pb-3 animate-slide-up">
            <form
              onSubmit={handleSubmitB}
              className="group"
              role="search"
              aria-label="Compare with user B"
            >
              <div className="relative">
                <span
                  className="
                    absolute left-3 top-1/2 -translate-y-1/2
                    text-xs font-mono font-semibold
                    px-1.5 py-0.5 rounded
                    pointer-events-none
                  "
                  style={{
                    background: "#38bdf8",
                    color: "var(--color-bg-base)",
                  }}
                  aria-hidden
                >
                  B
                </span>
                <input
                  type="text"
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                  placeholder="Compare with another GitHub user…"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={isLoading}
                  className="
                    w-full pl-10 pr-11 py-2.5 rounded-lg
                    bg-bg-surface border border-bg-border
                    text-sm text-text-primary placeholder:text-text-muted
                    font-mono
                    outline-none transition-all duration-200
                    focus:bg-bg-elevated
                    disabled:opacity-60 disabled:cursor-not-allowed
                  "
                  style={
                    {
                      "--tw-ring-color": "rgba(56, 189, 248, 0.2)",
                    } as React.CSSProperties
                  }
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(56, 189, 248, 0.5)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px rgba(56, 189, 248, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                  aria-label="Second GitHub username for comparison"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputB.trim()}
                  aria-label="Compare"
                  title="Compare"
                  className="
                    absolute right-1.5 top-1/2 -translate-y-1/2
                    w-8 h-8 rounded-md
                    flex items-center justify-center
                    transition-all duration-200
                    active:scale-90
                    disabled:opacity-40 disabled:cursor-not-allowed
                  "
                  style={{
                    background: "#38bdf8",
                    color: "var(--color-bg-base)",
                  }}
                >
                  <Search className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
