import { useState, useEffect } from "react";
import { Code2, AlertCircle, X, Star, LogIn } from "lucide-react";

import { Header } from "./components/Header";
import { DashboardColumn } from "./components/DashboardColumn";
import { Filters } from "./components/Filters";
import { ReposTable } from "./components/ReposTable";
import {
  FollowersGrid,
  FollowersSectionHeader,
} from "./components/FollowersGrid";

import { useUser, useRepos, useFollowers } from "./lib/hooks";
import { useAppStore } from "./lib/store";
import { useAuthStore } from "./lib/auth";
import { filterRepos } from "./lib/utils";
import { useMemo } from "react";

export default function App() {
  const username = useAppStore((s) => s.username);
  const usernameB = useAppStore((s) => s.usernameB);
  const compareMode = useAppStore((s) => s.compareMode);
  const filters = useAppStore((s) => s.filters);

  // For the "deep dive" section below the columns (filters + table + followers),
  // we always use User A's data. In compare mode this still shows under the
  // dual columns and pertains to A only.
  const userQuery = useUser(username);
  const reposQuery = useRepos(username);
  const followersQuery = useFollowers(username);

  const filteredRepos = useMemo(
    () => filterRepos(reposQuery.data ?? [], filters),
    [reposQuery.data, filters],
  );

  const userQueryError = userQuery.error as Error | null;
  const reposQueryError = reposQuery.error as Error | null;
  const fatalError =
    userQueryError?.message ?? reposQueryError?.message ?? null;

  const isLoading = userQuery.isLoading || reposQuery.isLoading;

  return (
    <div className="min-h-screen">
      <Header isLoading={isLoading} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* No username at all — welcome state */}
        {!username && !compareMode && <WelcomeState />}

        {/* Single mode + fatal error */}
        {!compareMode && username && fatalError && (
          <ErrorState message={fatalError} />
        )}

        {/* SINGLE MODE — one column, full dashboard */}
        {!compareMode && username && !fatalError && (
          <>
            <DashboardColumn username={username} accent="lime" />

            {/* Followers grid (single mode only) */}
            {userQuery.data && userQuery.data.followers > 0 && (
              <section className="card p-5 sm:p-6 animate-slide-up">
                <FollowersSectionHeader totalCount={userQuery.data.followers} />
                <FollowersGrid
                  followers={followersQuery.data ?? []}
                  totalCount={userQuery.data.followers}
                  loading={followersQuery.isLoading}
                />
              </section>
            )}

            {/* Filters + repos table (single mode only) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                {reposQuery.data && <Filters repos={reposQuery.data} />}
              </div>
              <div className="lg:col-span-2">
                <ReposTable
                  repos={filteredRepos}
                  pageSize={10}
                  exportFilename={`${username}-repos.csv`}
                />
              </div>
            </div>

            <Footer />
          </>
        )}

        {/* COMPARE MODE — two columns side-by-side */}
        {compareMode && (
          <>
            <CompareHint visible={!username || !usernameB} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DashboardColumn username={username} accent="lime" />
              <DashboardColumn username={usernameB} accent="sky" />
            </div>
            <Footer />
          </>
        )}
      </main>

      <AuthErrorToast />
    </div>
  );
}

/* ─────────── Helpers ─────────── */

function CompareHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="card p-5 text-center animate-fade-in max-w-2xl mx-auto">
      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">Compare mode</span> —
        enter two GitHub usernames above to see them side-by-side.
      </p>
    </div>
  );
}

function AuthErrorToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const w = window as Window & { __codeflowAuthError?: string };
    if (w.__codeflowAuthError) {
      setMessage(w.__codeflowAuthError);
      delete w.__codeflowAuthError;
    }
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 z-50 max-w-sm animate-slide-up"
    >
      <div className="flex items-start gap-3 glass rounded-xl p-4 shadow-2xl border border-red-500/20">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 ring-1 ring-red-500/20 shrink-0">
          <AlertCircle className="w-4 h-4 text-red-400" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">Sign-in error</p>
          <p className="text-xs text-text-secondary mt-0.5">{message}</p>
        </div>
        <button
          onClick={() => setMessage(null)}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-md text-text-muted hover:text-text-primary transition-colors duration-150"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function WelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center animate-fade-in">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 ring-1 ring-accent/30 mb-5">
        <Code2 className="w-8 h-8 text-accent" strokeWidth={2} />
      </div>
      <h1 className="font-display font-bold text-3xl sm:text-4xl text-text-primary tracking-tight">
        Welcome to <span className="brand-mark text-accent">CodeFlow</span>
      </h1>
      <p className="mt-3 text-text-secondary max-w-md">
        Search any GitHub user to explore their repositories, language mix, and
        commit activity. Or use compare mode to put two developers side-by-side.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center text-xs font-mono text-text-muted">
        <span>Try:</span>
        {[
          "torvalds",
          "gaearon",
          "tj",
          "sindresorhus",
          "Genius-mu",
          "summydev",
        ].map((u) => (
          <Suggestion key={u} username={u} />
        ))}
      </div>
    </div>
  );
}

function Suggestion({ username }: { username: string }) {
  const setUsername = useAppStore((s) => s.setUsername);
  return (
    <button
      onClick={() => setUsername(username)}
      className="px-2.5 py-1 rounded-md bg-bg-surface border border-bg-border text-text-secondary transition-all duration-200 hover:text-accent hover:border-accent/40 active:scale-95"
    >
      {username}
    </button>
  );
}

function ErrorState({ message }: { message: string }) {
  const isRateLimit = /rate limit/i.test(message);

  if (isRateLimit) {
    return <RateLimitState />;
  }

  return (
    <div className="card p-10 text-center animate-fade-in max-w-lg mx-auto">
      <h2 className="font-display font-semibold text-xl text-text-primary">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-text-secondary">{message}</p>
    </div>
  );
}

function RateLimitState() {
  const signIn = useAuthStore((s) => s.signIn);
  const isOAuthConfigured = useAuthStore((s) => s.isOAuthConfigured);

  return (
    <div className="card p-8 sm:p-10 text-center animate-fade-in max-w-xl mx-auto">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 ring-1 ring-accent/30 mx-auto mb-4">
        <Star className="w-6 h-6 text-accent" strokeWidth={2.25} />
      </div>
      <h2 className="font-display font-semibold text-xl text-text-primary tracking-tight">
        GitHub rate limit reached
      </h2>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
        GitHub allows 60 unauthenticated requests per hour.
        {isOAuthConfigured
          ? " Sign in to bump that to 5,000/hr — your own quota, your own data."
          : " OAuth isn't configured on this deployment. Try again in an hour."}
      </p>

      {isOAuthConfigured && (
        <button onClick={signIn} className="btn-primary text-sm mt-6">
          <LogIn className="w-4 h-4" strokeWidth={2.25} />
          Sign in with GitHub
        </button>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="pt-8 pb-4 text-center text-xs font-mono text-text-muted">
      Data from the public GitHub API · No tracking
    </footer>
  );
}

// Working CodeFlow "Hurrayyyy, i reduced the API request from 129 to 33 (3)... the other 30 are browser request"
