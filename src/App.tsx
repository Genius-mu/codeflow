import { useMemo, useState } from "react";
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
} from "lucide-react";

import { Header } from "./components/Header";
import { MetricCard } from "./components/MetricCard";
import { ChartContainer } from "./components/ChartContainer";
import { Filters } from "./components/Filters";
import { ReposTable } from "./components/ReposTable";

import { useUser, useRepos, useCommits } from "./lib/hooks";
import { useAppStore } from "./lib/store";
import {
  filterRepos,
  groupReposByLanguage,
  buildCommitTimeline,
  computeMetrics,
  formatCompact,
  getTopReposByStars,
  CHART_COLORS,
} from "./lib/utils";

export default function App() {
  const username = useAppStore((s) => s.username);
  const filters = useAppStore((s) => s.filters);

  // Data layer
  const userQuery = useUser(username);
  const reposQuery = useRepos(username);
  const commitsQuery = useCommits(username, reposQuery.data, 30);

  // Anything fetching counts as global loading for the header spinner
  const isLoading =
    userQuery.isLoading || reposQuery.isLoading || commitsQuery.isFetching;

  // Apply filters once. Memoized because every render of App would otherwise
  // re-walk the repo list — and chart components consume this many times.
  const filteredRepos = useMemo(
    () => filterRepos(reposQuery.data ?? [], filters),
    [reposQuery.data, filters],
  );

  // Derived data for the visualizations
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

  // Top-level errors (user not found, rate limit, etc.)
  const fatalError =
    (userQuery.error as Error | null)?.message ??
    (reposQuery.error as Error | null)?.message ??
    null;

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
            {/* Profile strip */}
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

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Filters + Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sidebar — filters */}
              <div className="lg:col-span-1">
                {reposQuery.data && <Filters repos={reposQuery.data} />}
              </div>

              {/* Main — charts */}
              <div className="lg:col-span-2 space-y-4">
                {/* Languages */}
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
                      >
                        {languageData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<CustomPieTooltip />}
                        cursor={{ fill: "transparent" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Custom legend — much cleaner than Recharts' default */}
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

                {/* Top repos */}
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
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>

                {/* Commits */}
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
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>

            {/* Repos table */}
            <ReposTable
              repos={filteredRepos}
              pageSize={10}
              exportFilename={`${username}-repos.csv`}
            />

            <Footer />
          </>
        )}
      </main>
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

function RateLimitState() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const trimmed = token.trim();
    if (!trimmed) return;
    localStorage.setItem("github_token", trimmed);
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className="card p-8 sm:p-10 text-center animate-fade-in max-w-xl mx-auto">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 ring-1 ring-accent/30 mx-auto mb-4">
        <Star className="w-6 h-6 text-accent" strokeWidth={2.25} />
      </div>
      <h2 className="font-display font-semibold text-xl text-text-primary tracking-tight">
        GitHub rate limit reached
      </h2>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
        GitHub allows 60 unauthenticated requests per hour. Add a free personal
        access token to bump that to 5,000/hr.
      </p>

      <ol className="mt-6 text-left text-sm text-text-secondary space-y-2 max-w-md mx-auto font-mono">
        <li>
          <span className="text-accent">1.</span> Open{" "}
          <a
            href="https://github.com/settings/tokens/new?description=CodeFlow&scopes="
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover underline underline-offset-2"
          >
            github.com/settings/tokens/new
          </a>
        </li>
        <li>
          <span className="text-accent">2.</span> Click{" "}
          <span className="text-text-primary">Generate token</span> — no scopes
          needed
        </li>
        <li>
          <span className="text-accent">3.</span> Paste it below
        </li>
      </ol>

      <div className="mt-6 flex gap-2 max-w-md mx-auto">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_..."
          spellCheck={false}
          autoComplete="off"
          className="
            flex-1 px-3 py-2 rounded-lg
            bg-bg-elevated border border-bg-border
            text-sm text-text-primary placeholder:text-text-muted
            font-mono
            outline-none transition-all duration-200
            focus:border-accent/50 focus:ring-2 focus:ring-accent/20
          "
        />
        <button
          onClick={handleSave}
          disabled={!token.trim() || saved}
          className="btn-primary text-sm whitespace-nowrap"
        >
          {saved ? "Saved ✓" : "Save & retry"}
        </button>
      </div>

      <p className="mt-4 text-xs text-text-muted max-w-md mx-auto">
        Your token stays in your browser's localStorage. It's only sent to
        api.github.com.
      </p>
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
      Data from the public GitHub API · No login, no tracking
    </footer>
  );
}

/* ─────────── Custom chart tooltips ─────────── */

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
