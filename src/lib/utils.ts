import type { GitHubRepo, GitHubCommit } from "./schemas";
import type { Filters } from "./store";

/**
 * Apply user filters to a list of repos.
 * Pure function — same input always produces same output.
 *
 * Order matters for performance: cheapest checks first so we
 * short-circuit before evaluating more expensive ones.
 */
export function filterRepos(
  repos: GitHubRepo[],
  filters: Filters,
): GitHubRepo[] {
  return repos.filter((repo) => {
    // Cheapest check: boolean
    if (!filters.includeForks && repo.fork) return false;

    // Number comparison
    if (repo.stargazers_count < filters.minStars) return false;

    // Array lookup — only if a language filter is set
    if (filters.languages.length > 0) {
      if (!repo.language) return false;
      if (!filters.languages.includes(repo.language)) return false;
    }

    return true;
  });
}

/**
 * Group repos by programming language for the pie/donut chart.
 * Returns sorted descending so the largest slice is first.
 *
 * Repos with no language (rare — mostly README-only) are bucketed as "Other".
 */
export interface LanguageDatum {
  name: string;
  value: number;
  percentage: number;
}

export function groupReposByLanguage(repos: GitHubRepo[]): LanguageDatum[] {
  if (repos.length === 0) return [];

  const counts = new Map<string, number>();
  for (const repo of repos) {
    const lang = repo.language ?? "Other";
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }

  const total = repos.length;
  return Array.from(counts.entries())
    .map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / total) * 100),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Build a daily commit timeline for the line chart.
 * Returns ONE entry per day in the range, even days with zero commits —
 * otherwise the line chart skips days and looks misleading.
 */
export interface CommitDatum {
  date: string; // YYYY-MM-DD — sorts naturally as a string
  label: string; // "Mar 14" — what we render on the axis
  commits: number;
}

export function buildCommitTimeline(
  commits: GitHubCommit[],
  daysBack: number = 30,
): CommitDatum[] {
  // Tally commits by day
  const counts = new Map<string, number>();
  for (const commit of commits) {
    const date = commit.commit.author.date.slice(0, 10); // "2026-04-25"
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  // Emit every day in the window — including zeros — so the chart is continuous
  const timeline: CommitDatum[] = [];
  const today = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    timeline.push({
      date: iso,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      commits: counts.get(iso) ?? 0,
    });
  }
  return timeline;
}

/**
 * Top N repos by star count — for the bar chart in Week 2.
 * Trims long names so they fit on the chart axis.
 */
export interface TopRepoDatum {
  name: string;
  fullName: string;
  stars: number;
  forks: number;
}

export function getTopReposByStars(
  repos: GitHubRepo[],
  limit: number = 10,
): TopRepoDatum[] {
  return [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, limit)
    .map((repo) => ({
      name: repo.name.length > 18 ? repo.name.slice(0, 17) + "…" : repo.name,
      fullName: repo.name,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
    }));
}

/**
 * Summary metrics for the top stat cards.
 * Computed once per render of the dashboard — no need to memoize for this scale.
 */
export interface Metrics {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  topLanguage: string | null;
}

export function computeMetrics(repos: GitHubRepo[]): Metrics {
  if (repos.length === 0) {
    return { totalRepos: 0, totalStars: 0, totalForks: 0, topLanguage: null };
  }

  let totalStars = 0;
  let totalForks = 0;
  for (const repo of repos) {
    totalStars += repo.stargazers_count;
    totalForks += repo.forks_count;
  }

  const langs = groupReposByLanguage(repos);
  return {
    totalRepos: repos.length,
    totalStars,
    totalForks,
    topLanguage: langs[0]?.name ?? null,
  };
}

/**
 * Get the unique list of languages across all repos — feeds the language filter dropdown.
 * Sorted alphabetically for predictable UI.
 */
export function getUniqueLanguages(repos: GitHubRepo[]): string[] {
  const set = new Set<string>();
  for (const repo of repos) {
    if (repo.language) set.add(repo.language);
  }
  return Array.from(set).sort();
}

/**
 * Format large numbers compactly: 1247 → "1.2K", 1500000 → "1.5M".
 * Used in metric cards so the number doesn't overflow.
 */
export function formatCompact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/**
 * Lime/green palette for charts — derived from our accent color.
 * Recharts cycles through these for pie slices and bars.
 * Mixed warm + cool tones around the lime hub so adjacent slices stay distinguishable.
 */
export const CHART_COLORS = [
  "#a3e635", // lime-400 (accent)
  "#65a30d", // lime-700
  "#bef264", // lime-300
  "#4d7c0f", // lime-800
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#16a34a", // green-600
  "#86efac", // green-300
  "#15803d", // green-700
  "#d9f99d", // lime-200
];
