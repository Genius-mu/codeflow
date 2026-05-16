import { useMemo, useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  BookMarked,
  Star,
  GitFork,
  Code2,
  Users,
  MapPin,
  Building2,
  Link as LinkIcon,
  Activity,
  LogIn,
  X,
  AlertCircle,
} from "lucide-react";

import { Header } from "./components/Header";
import { MetricCard } from "./components/MetricCard";
import { ChartContainer } from "./components/ChartContainer";
import { Filters } from "./components/Filters";
import { ReposTable } from "./components/ReposTable";
import { Heatmap } from "./components/Heatmap";

import { useUser, useRepos, useCommits, useContributions } from "./lib/hooks";
import { useAppStore } from "./lib/store";
import { useAuthStore } from "./lib/auth";
import {
  filterRepos,
  groupReposByLanguage,
  buildCommitTimeline,
  computeMetrics,
  formatCompact,
  getTopReposByStars,
  CHART_COLORS,
} from "./lib/utils";

/**
 * Shared Recharts tooltip styles.
 *
 * `isAnimationActive={false}` is the key fix for "tooltip starts at wrong
 * position then transitions" — Recharts defaults to animating tooltip
 * position, which on first hover means it slides in from the chart's
 * top-left corner. Disabling animation makes the tooltip appear instantly
 * at the cursor.
 *
 * `wrapperStyle.outline: 'none'` removes the default focus ring that
 * Recharts adds to the tooltip wrapper.
 */
const TOOLTIP_PROPS = {
  isAnimationActive: false,
  wrapperStyle: { outline: "none" },
} as const;

export default function App() {
  const username = useAppStore((s) => s.username);
  const filters = useAppStore((s) => s.filters);

  // Data layer
  const userQuery = useUser(username);
  const reposQuery = useRepos(username);
  const commitsQuery = useCommits(username, reposQuery.data, 30);
  const contributionsQuery = useContributions(username);

  const isLoading =
    userQuery.isLoading ||
    reposQuery.isLoading ||
    commitsQuery.isFetching ||
    contributionsQuery.isFetching;

  const filteredRepos = useMemo(
    () => filterRepos(reposQuery.data ?? [], filters),
    [reposQuery.data, filters],
  );

  const metrics = useMemo(() => computeMetrics(filteredRepos), [filteredRepos]);
  const languageData = useMemo(
    () => groupReposByLanguage(filteredRepos),
    [filteredRepos],
  );
  const commitTimeline = useMemo(
    () => buildCommitTimeline(commitsQuery.data ?? [], 30),
    [commitsQuery.data],
  );
  const topRepos = useMemo(
    () => getTopReposByStars(filteredRepos, 8),
    [filteredRepos],
  );

  const fatalError =
    (userQuery.error as Error | null)?.message ??
    (reposQuery.error as Error | null)?.message ??
    null;

  const contributionsError = contributionsQuery.error as
    | (Error & { status?: number })
    | null;
  const needsToken = contributionsError?.status === 401;

  return (
    <div className="min-h-screen">
      <Header isLoading={isLoading} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ───────── Initial state — no search yet ───────── */}
        {!username && <WelcomeState />}

        {/* ───────── Fatal error ───────── */}
        {username && fatalError && <ErrorState message={fatalError} />}

        {/* ───────── Loaded state ───────── */}
        {username && !fatalError && (
          <>
            {userQuery.data && (
              <ProfileStrip
                avatar={userQuery.data.avatar_url}
                name={userQuery.data.name ?? userQuery.data.login}
                login={userQuery.data.login}
                bio={userQuery.data.bio}
                followers={userQuery.data.followers}
                following={userQuery.data.following}
                location={userQuery.data.location}
                company={userQuery.data.company}
                blog={userQuery.data.blog}
              />
            )}

            {/* Contribution heatmap */}
            <section className="card p-5 sm:p-6 animate-slide-up">
              <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
                <div>
                  <h3 className="font-display font-semibold text-base sm:text-lg text-text-primary tracking-tight flex items-center gap-2">
                    <Activity
                      className="w-4 h-4 text-accent"
                      strokeWidth={2.25}
                    />
                    Contribution activity
                  </h3>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {contributionsQuery.data
                      ? `${contributionsQuery.data.totalContributions.toLocaleString()} contributions in the last year`
                      : "Last 12 months"}
                  </p>
                </div>
              </div>

              {contributionsQuery.isLoading ? (
                <HeatmapSkeleton />
              ) : needsToken ? (
                <HeatmapSignInPrompt />
              ) : contributionsError ? (
                <p className="text-sm text-text-muted py-8 text-center font-mono">
                  Couldn't load contribution data: {contributionsError.message}
                </p>
              ) : contributionsQuery.data ? (
                <Heatmap calendar={contributionsQuery.data} />
              ) : null}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Repos"
                value={formatCompact(metrics.totalRepos)}
                icon={BookMarked}
                loading={reposQuery.isLoading}
              />
              <MetricCard
                label="Total Stars"
                value={formatCompact(metrics.totalStars)}
                icon={Star}
                loading={reposQuery.isLoading}
              />
              <MetricCard
                label="Total Forks"
                value={formatCompact(metrics.totalForks)}
                icon={GitFork}
                loading={reposQuery.isLoading}
              />
              <MetricCard
                label="Top Language"
                value={metrics.topLanguage ?? "—"}
                icon={Code2}
                loading={reposQuery.isLoading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                {reposQuery.data && <Filters repos={reposQuery.data} />}
              </div>

              <div className="lg:col-span-2 space-y-4">
                <ChartContainer
                  title="Languages"
                  subtitle="Distribution across filtered repos"
                  loading={reposQuery.isLoading}
                  isEmpty={!reposQuery.isLoading && languageData.length === 0}
                  emptyMessage="No repos match your filters"
                  skeletonType="donut"
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={languageData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        stroke="var(--color-bg-surface)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {languageData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_PROPS}
                        content={<CustomPieTooltip />}
                        cursor={{ fill: "transparent" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
                    {languageData.slice(0, 8).map((d, i) => (
                      <div
                        key={d.name}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{
                            backgroundColor:
                              CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                        <span className="text-text-secondary font-mono">
                          {d.name}
                        </span>
                        <span className="text-text-muted font-mono">
                          {d.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </ChartContainer>

                <ChartContainer
                  title="Top repos by stars"
                  subtitle="Highest-starred repositories"
                  loading={reposQuery.isLoading}
                  isEmpty={!reposQuery.isLoading && topRepos.length === 0}
                  emptyMessage="No repos to rank"
                  skeletonType="bars"
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topRepos}
                      layout="vertical"
                      margin={{ top: 5, right: 16, bottom: 5, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="barGradient"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#65a30d" />
                          <stop offset="100%" stopColor="#a3e635" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-bg-border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={110}
                      />
                      <Tooltip
                        {...TOOLTIP_PROPS}
                        content={<CustomBarTooltip />}
                        cursor={{
                          fill: "var(--color-bg-elevated)",
                          opacity: 0.4,
                        }}
                      />
                      <Bar
                        dataKey="stars"
                        fill="url(#barGradient)"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer
                  title="Commit activity"
                  subtitle="Last 30 days, own repos only"
                  loading={commitsQuery.isLoading || commitsQuery.isFetching}
                  isEmpty={
                    !commitsQuery.isLoading &&
                    commitTimeline.every((d) => d.commits === 0)
                  }
                  emptyMessage="No commits in the last 30 days"
                  skeletonType="line"
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={commitTimeline}
                      margin={{ top: 10, right: 10, bottom: 0, left: -16 }}
                    >
                      <defs>
                        <linearGradient
                          id="lineGradient"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#84cc16" />
                          <stop offset="100%" stopColor="#a3e635" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-bg-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval={4}
                      />
                      <YAxis
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        {...TOOLTIP_PROPS}
                        content={<CustomLineTooltip />}
                        cursor={{
                          stroke: "var(--color-accent)",
                          strokeWidth: 1,
                          strokeDasharray: "3 3",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="commits"
                        stroke="url(#lineGradient)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: "#a3e635",
                          stroke: "var(--color-bg-surface)",
                          strokeWidth: 2,
                        }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>

            <ReposTable
              repos={filteredRepos}
              pageSize={10}
              exportFilename={`${username}-repos.csv`}
            />

            <Footer />
          </>
        )}
      </main>

      {/* Surfaces OAuth flow errors set by main.tsx */}
      <AuthErrorToast />
    </div>
  );
}

/* ─────────── Heatmap support components ─────────── */

function HeatmapSkeleton() {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-[3px] py-2" aria-hidden>
        {Array.from({ length: 53 }).map((_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, d) => (
              <div
                key={d}
                className="
                  w-[11px] h-[11px] rounded-[2px]
                  bg-bg-elevated relative overflow-hidden
                "
              >
                <div
                  className="
                    absolute inset-0 -translate-x-full animate-shimmer
                    bg-gradient-to-r from-transparent via-bg-border to-transparent
                    bg-[length:1000px_100%]
                  "
                  style={{ animationDelay: `${(w * 7 + d) * 8}ms` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Replaces the old "paste your token here" prompt — now we just invite the
 * user to sign in with one click.
 */
function HeatmapSignInPrompt() {
  const signIn = useAuthStore((s) => s.signIn);
  const isOAuthConfigured = useAuthStore((s) => s.isOAuthConfigured);

  return (
    <div className="text-center py-10 px-4 animate-fade-in">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 ring-1 ring-accent/30 mx-auto mb-4">
        <Activity className="w-6 h-6 text-accent" strokeWidth={2.25} />
      </div>
      <p className="text-sm text-text-primary font-medium">
        Sign in to see contribution data
      </p>
      <p className="text-xs text-text-muted mt-1.5 max-w-md mx-auto">
        GitHub's GraphQL API requires authentication.
        {isOAuthConfigured ? " One click — no token to copy." : ""}
      </p>
      {isOAuthConfigured ? (
        <button onClick={signIn} className="btn-primary text-sm mt-5">
          <LogIn className="w-4 h-4" strokeWidth={2.25} />
          Sign in with GitHub
        </button>
      ) : (
        <p className="text-xs text-text-muted mt-4">
          OAuth isn't configured on this deployment.
        </p>
      )}
    </div>
  );
}

/**
 * Bottom-right toast. Reads the OAuth error stashed on window by main.tsx
 * and clears it once shown.
 */
function AuthErrorToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const w = window as Window & { __codeflowAuthError?: string };
    if (w.__codeflowAuthError) {
      setMessage(w.__codeflowAuthError);
      delete w.__codeflowAuthError;
    }
  }, []);

  // Auto-dismiss after 6s
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="
        fixed bottom-5 right-5 z-50
        max-w-sm
        animate-slide-up
      "
    >
      <div
        className="
        flex items-start gap-3
        glass rounded-xl p-4 shadow-2xl
        border border-red-500/20
      "
      >
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
          className="
            shrink-0 -mr-1 -mt-1 p-1 rounded-md
            text-text-muted hover:text-text-primary
            transition-colors duration-150
          "
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─────────── Sub-components for readability ─────────── */

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
        commit activity at a glance.
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
      className="
        px-2.5 py-1 rounded-md
        bg-bg-surface border border-bg-border
        text-text-secondary
        transition-all duration-200
        hover:text-accent hover:border-accent/40
        active:scale-95
      "
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

/**
 * Rate-limit state — now invites OAuth sign-in instead of asking for a token.
 */
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

interface ProfileStripProps {
  avatar: string;
  name: string;
  login: string;
  bio: string | null;
  followers: number;
  following: number;
  location: string | null;
  company: string | null;
  blog: string | null;
}

function ProfileStrip({
  avatar,
  name,
  login,
  bio,
  followers,
  following,
  location,
  company,
  blog,
}: ProfileStripProps) {
  return (
    <section className="card p-5 sm:p-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <img
          src={avatar}
          alt={`${login}'s avatar`}
          className="
            w-20 h-20 sm:w-24 sm:h-24 rounded-2xl
            ring-2 ring-bg-border
            transition-all duration-300
            hover:ring-accent/40 hover:scale-105
          "
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display font-bold text-2xl text-text-primary tracking-tight">
              {name}
            </h2>
            <span className="font-mono text-sm text-text-muted">@{login}</span>
          </div>
          {bio && (
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed max-w-2xl">
              {bio}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span className="text-text-secondary font-mono tabular-nums">
                {formatCompact(followers)}
              </span>{" "}
              followers
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <span className="tabular-nums text-text-secondary">
                {following}
              </span>{" "}
              following
            </span>
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {location}
              </span>
            )}
            {company && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {company}
              </span>
            )}
            {blog && (
              <a
                href={blog.startsWith("http") ? blog : `https://${blog}`}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex items-center gap-1.5
                  text-accent hover:text-accent-hover
                  transition-colors
                "
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {blog.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="pt-8 pb-4 text-center text-xs font-mono text-text-muted">
      Data from the public GitHub API · No tracking
    </footer>
  );
}

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: {
    name?: string;
    percentage?: number;
    label?: string;
    fullName?: string;
    forks?: number;
  };
}

function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-mono text-text-primary font-semibold">
        {d.name ?? d.payload?.name}
      </div>
      <div className="font-mono text-text-secondary tabular-nums">
        {d.value} repos · {d.payload?.percentage}%
      </div>
    </div>
  );
}

function CustomLineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-mono text-text-muted">{d.payload?.label}</div>
      <div className="font-mono text-accent tabular-nums font-semibold">
        {d.value} commit{d.value === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function CustomBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const fullName = d.payload?.fullName;
  const forks = d.payload?.forks ?? 0;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-mono text-text-primary font-semibold">
        {fullName}
      </div>
      <div className="font-mono text-accent tabular-nums">
        ★ {d.value} stars
      </div>
      <div className="font-mono text-text-muted tabular-nums">
        ⑂ {forks} forks
      </div>
    </div>
  );
}
