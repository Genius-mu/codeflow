import { useMemo } from "react";
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
} from "lucide-react";

import { MetricCard } from "./MetricCard";
import { ChartContainer } from "./ChartContainer";
import { Heatmap } from "./Heatmap";

import { useUser, useRepos, useContributions } from "../lib/hooks";
import { useAuthStore } from "../lib/auth";
import {
  groupReposByLanguage,
  buildCommitTimeline,
  computeMetrics,
  formatCompact,
  getTopReposByStars,
  CHART_COLORS,
  CHART_COLORS_B,
} from "../lib/utils";

const TOOLTIP_PROPS = {
  isAnimationActive: false,
  wrapperStyle: { outline: "none" },
} as const;

export type ColumnAccent = "lime" | "sky";

interface DashboardColumnProps {
  username: string;
  accent: ColumnAccent;
  /** When true, render a slimmer version (fewer details) for compare mode */
  compact?: boolean;
}

/**
 * Single-user dashboard column.
 * In single-view mode, this is the whole dashboard.
 * In compare mode, two of these sit side-by-side.
 *
 * Accent controls the color theme of charts and accents — lime for A, sky for B.
 */
export function DashboardColumn({
  username,
  accent,
  compact = false,
}: DashboardColumnProps) {
  const userQuery = useUser(username);
  const reposQuery = useRepos(username);
  const contributionsQuery = useContributions(username);

  const repos = reposQuery.data ?? [];

  const metrics = useMemo(() => computeMetrics(repos), [repos]);
  const languageData = useMemo(() => groupReposByLanguage(repos), [repos]);
  const commitTimeline = useMemo(
    () => buildCommitTimeline(contributionsQuery.data, 30),
    [contributionsQuery.data],
  );
  const topRepos = useMemo(() => getTopReposByStars(repos, 8), [repos]);

  const fatalError =
    (userQuery.error as Error | null)?.message ??
    (reposQuery.error as Error | null)?.message ??
    null;

  const contributionsError = contributionsQuery.error as
    | (Error & { status?: number })
    | null;
  const needsToken = contributionsError?.status === 401;

  const colors = accent === "sky" ? CHART_COLORS_B : CHART_COLORS;
  const accentHex = accent === "sky" ? "#38bdf8" : "#a3e635";
  const gradientId = `barGradient-${accent}`;
  const lineGradientId = `lineGradient-${accent}`;

  // Empty column — no username entered yet
  if (!username) {
    return (
      <div className="card p-10 text-center animate-fade-in">
        <ColumnBadge accent={accent} />
        <p className="mt-4 text-sm font-mono text-text-muted">
          Enter a GitHub username above
        </p>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="card p-10 text-center animate-fade-in">
        <ColumnBadge accent={accent} username={username} />
        <h3 className="mt-4 font-display font-semibold text-lg text-text-primary">
          Couldn't load this user
        </h3>
        <p className="mt-2 text-sm text-text-secondary">{fatalError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header badge — which column is this? */}
      <ColumnBadge accent={accent} username={username} />

      {/* Profile strip */}
      {userQuery.data && (
        <ColumnProfileStrip
          avatar={userQuery.data.avatar_url}
          name={userQuery.data.name ?? userQuery.data.login}
          login={userQuery.data.login}
          bio={userQuery.data.bio}
          followers={userQuery.data.followers}
          following={userQuery.data.following}
          location={userQuery.data.location}
          company={userQuery.data.company}
          blog={userQuery.data.blog}
          accentHex={accentHex}
          compact={compact}
        />
      )}

      {/* Contribution heatmap */}
      <section className="card p-5">
        <div className="mb-4">
          <h3 className="font-display font-semibold text-base text-text-primary tracking-tight flex items-center gap-2">
            <Activity
              className="w-4 h-4"
              strokeWidth={2.25}
              style={{ color: accentHex }}
            />
            Contribution activity
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {contributionsQuery.data
              ? `${contributionsQuery.data.totalContributions.toLocaleString()} in the last year`
              : "Last 12 months"}
          </p>
        </div>
        {contributionsQuery.isLoading ? (
          <HeatmapSkeletonInline />
        ) : needsToken ? (
          <SignInPromptInline />
        ) : contributionsError ? (
          <p className="text-xs text-text-muted py-6 text-center font-mono">
            {contributionsError.message}
          </p>
        ) : contributionsQuery.data ? (
          <Heatmap calendar={contributionsQuery.data} accentHex={accentHex} />
        ) : null}
      </section>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Repos"
          value={formatCompact(metrics.totalRepos)}
          icon={BookMarked}
          loading={reposQuery.isLoading}
        />
        <MetricCard
          label="Stars"
          value={formatCompact(metrics.totalStars)}
          icon={Star}
          loading={reposQuery.isLoading}
        />
        <MetricCard
          label="Forks"
          value={formatCompact(metrics.totalForks)}
          icon={GitFork}
          loading={reposQuery.isLoading}
        />
        <MetricCard
          label="Top Lang"
          value={metrics.topLanguage ?? "—"}
          icon={Code2}
          loading={reposQuery.isLoading}
        />
      </div>

      {/* Languages donut */}
      <ChartContainer
        title="Languages"
        subtitle="Repo distribution"
        loading={reposQuery.isLoading}
        isEmpty={!reposQuery.isLoading && languageData.length === 0}
        emptyMessage="No repos to analyze"
        skeletonType="donut"
      >
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={languageData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              stroke="var(--color-bg-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {languageData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_PROPS}
              content={<CompactPieTooltip />}
              cursor={{ fill: "transparent" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 justify-center">
          {languageData.slice(0, 6).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px]">
              <span
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="text-text-secondary font-mono">{d.name}</span>
              <span className="text-text-muted font-mono">{d.percentage}%</span>
            </div>
          ))}
        </div>
      </ChartContainer>

      {/* Top repos bars */}
      <ChartContainer
        title="Top repos by stars"
        loading={reposQuery.isLoading}
        isEmpty={!reposQuery.isLoading && topRepos.length === 0}
        emptyMessage="No repos"
        skeletonType="bars"
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={topRepos}
            layout="vertical"
            margin={{ top: 5, right: 16, bottom: 5, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[1]} />
                <stop offset="100%" stopColor={colors[0]} />
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
              fontSize={9}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--color-text-muted)"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              content={<CompactBarTooltip />}
              cursor={{ fill: "var(--color-bg-elevated)", opacity: 0.4 }}
            />
            <Bar
              dataKey="stars"
              fill={`url(#${gradientId})`}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Activity line */}
      <ChartContainer
        title="Activity (30 days)"
        loading={contributionsQuery.isLoading}
        isEmpty={
          !contributionsQuery.isLoading &&
          commitTimeline.every((d) => d.commits === 0)
        }
        emptyMessage="No activity"
        skeletonType="line"
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={commitTimeline}
            margin={{ top: 10, right: 10, bottom: 0, left: -16 }}
          >
            <defs>
              <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colors[4]} />
                <stop offset="100%" stopColor={colors[0]} />
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
              fontSize={9}
              tickLine={false}
              axisLine={false}
              interval={5}
            />
            <YAxis
              stroke="var(--color-text-muted)"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              content={<CompactLineTooltip accentHex={accentHex} />}
              cursor={{
                stroke: accentHex,
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
            />
            <Line
              type="monotone"
              dataKey="commits"
              stroke={`url(#${lineGradientId})`}
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: accentHex,
                stroke: "var(--color-bg-surface)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

/* ─────────── Column-local components ─────────── */

function ColumnBadge({
  accent,
  username,
}: {
  accent: ColumnAccent;
  username?: string;
}) {
  const accentHex = accent === "sky" ? "#38bdf8" : "#a3e635";
  const label = accent === "sky" ? "B" : "A";
  return (
    <div className="flex items-center gap-2">
      <span
        className="
          inline-flex items-center justify-center
          w-6 h-6 rounded-md
          text-xs font-mono font-bold
        "
        style={{
          background: accentHex,
          color: "var(--color-bg-base)",
        }}
      >
        {label}
      </span>
      {username && (
        <span className="font-mono text-sm text-text-secondary">
          @{username}
        </span>
      )}
    </div>
  );
}

interface ColumnProfileStripProps {
  avatar: string;
  name: string;
  login: string;
  bio: string | null;
  followers: number;
  following: number;
  location: string | null;
  company: string | null;
  blog: string | null;
  accentHex: string;
  compact?: boolean;
}

function ColumnProfileStrip({
  avatar,
  name,
  login,
  bio,
  followers,
  following,
  location,
  company,
  blog,
  accentHex,
  compact,
}: ColumnProfileStripProps) {
  return (
    <section className="card p-5">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <img
          src={avatar}
          alt={`${login}'s avatar`}
          className="
            w-16 h-16 sm:w-20 sm:h-20 rounded-2xl
            ring-2 transition-all duration-300
            hover:scale-105
          "
          style={{ borderColor: accentHex }}
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="font-display font-bold text-xl text-text-primary tracking-tight truncate">
              {name}
            </h2>
            <span className="font-mono text-xs text-text-muted">@{login}</span>
          </div>
          {bio && !compact && (
            <p className="mt-1 text-xs text-text-secondary leading-relaxed line-clamp-2">
              {bio}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span
                className="font-mono tabular-nums"
                style={{ color: accentHex }}
              >
                {formatCompact(followers)}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              {following} following
            </span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location}
              </span>
            )}
            {company && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {company}
              </span>
            )}
            {blog && (
              <a
                href={blog.startsWith("http") ? blog : `https://${blog}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors"
                style={{ color: accentHex }}
              >
                <LinkIcon className="w-3 h-3" />
                {blog.replace(/^https?:\/\//, "").slice(0, 24)}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeatmapSkeletonInline() {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-[2px] py-2" aria-hidden>
        {Array.from({ length: 53 }).map((_, w) => (
          <div key={w} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((_, d) => (
              <div
                key={d}
                className="w-[9px] h-[9px] rounded-[2px] bg-bg-elevated"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SignInPromptInline() {
  const signIn = useAuthStore((s) => s.signIn);
  const isOAuthConfigured = useAuthStore((s) => s.isOAuthConfigured);

  return (
    <div className="text-center py-6 px-3">
      <p className="text-xs text-text-secondary">
        Sign in to load contribution data
      </p>
      {isOAuthConfigured && (
        <button
          onClick={signIn}
          className="btn-primary text-xs mt-3 py-1.5 px-3"
        >
          <LogIn className="w-3 h-3" strokeWidth={2.25} />
          Sign in
        </button>
      )}
    </div>
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

function CompactPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass rounded-md px-2 py-1 text-[11px] shadow-xl">
      <div className="font-mono text-text-primary font-semibold">
        {d.name ?? d.payload?.name}
      </div>
      <div className="font-mono text-text-secondary tabular-nums">
        {d.value} · {d.payload?.percentage}%
      </div>
    </div>
  );
}

function CompactBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass rounded-md px-2 py-1 text-[11px] shadow-xl">
      <div className="font-mono text-text-primary font-semibold">
        {d.payload?.fullName}
      </div>
      <div className="font-mono text-text-muted tabular-nums">★ {d.value}</div>
    </div>
  );
}

function CompactLineTooltip({
  active,
  payload,
  accentHex,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  accentHex: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass rounded-md px-2 py-1 text-[11px] shadow-xl">
      <div className="font-mono text-text-muted">{d.payload?.label}</div>
      <div
        className="font-mono tabular-nums font-semibold"
        style={{ color: accentHex }}
      >
        {d.value} contribution{d.value === 1 ? "" : "s"}
      </div>
    </div>
  );
}
