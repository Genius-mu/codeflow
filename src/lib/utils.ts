import type { GitHubRepo, ContributionCalendar } from "./schemas";
import type { Filters } from "./store";

export function filterRepos(
  repos: GitHubRepo[],
  filters: Filters,
): GitHubRepo[] {
  return repos.filter((repo) => {
    if (!filters.includeForks && repo.fork) return false;
    if (repo.stargazers_count < filters.minStars) return false;

    if (filters.languages.length > 0) {
      if (!repo.language) return false;
      if (!filters.languages.includes(repo.language)) return false;
    }

    return true;
  });
}

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

export interface CommitDatum {
  date: string;
  label: string;
  commits: number;
}

export function buildCommitTimeline(
  calendar: ContributionCalendar | undefined,
  daysBack: number = 30,
): CommitDatum[] {
  if (!calendar) return [];

  const allDays = calendar.weeks.flatMap((w) => w.contributionDays);
  const byDate = new Map(allDays.map((d) => [d.date, d.contributionCount]));

  const timeline: CommitDatum[] = [];
  const today = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    timeline.push({
      date: iso,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      commits: byDate.get(iso) ?? 0,
    });
  }
  return timeline;
}

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

export function getUniqueLanguages(repos: GitHubRepo[]): string[] {
  const set = new Set<string>();
  for (const repo of repos) {
    if (repo.language) set.add(repo.language);
  }
  return Array.from(set).sort();
}

export function formatCompact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/* ───────────── Chart palettes ───────────── */

/**
 * Column A — lime, our brand accent.
 */
export const CHART_COLORS = [
  "#a3e635",
  "#65a30d",
  "#bef264",
  "#4d7c0f",
  "#84cc16",
  "#22c55e",
  "#16a34a",
  "#86efac",
  "#15803d",
  "#d9f99d",
];

/**
 * Column B — sky blue, for compare mode visual differentiation.
 * Chosen because it's complementary to lime (high contrast across the wheel)
 * but still feels cool and modern — not red/warning, not aggressive.
 */
export const CHART_COLORS_B = [
  "#38bdf8",
  "#0284c7",
  "#7dd3fc",
  "#0369a1",
  "#0ea5e9",
  "#06b6d4",
  "#0891b2",
  "#bae6fd",
  "#155e75",
  "#e0f2fe",
];

/* ───────────── CSV export ───────────── */

function escapeCSVCell(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function reposToCSV(repos: GitHubRepo[]): string {
  const headers = [
    "name",
    "full_name",
    "description",
    "language",
    "stars",
    "forks",
    "watchers",
    "open_issues",
    "is_fork",
    "is_archived",
    "topics",
    "created_at",
    "updated_at",
    "url",
  ];

  const rows = repos.map((r) =>
    [
      r.name,
      r.full_name,
      r.description,
      r.language,
      r.stargazers_count,
      r.forks_count,
      r.watchers_count,
      r.open_issues_count,
      r.fork,
      r.archived,
      r.topics.join(" "),
      r.created_at,
      r.updated_at,
      r.html_url,
    ]
      .map(escapeCSVCell)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
