import { useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Star,
  GitFork,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { GitHubRepo } from "../lib/schemas";
import { CHART_COLORS } from "../lib/utils";

type SortKey =
  | "name"
  | "language"
  | "stargazers_count"
  | "forks_count"
  | "updated_at";
type SortDir = "asc" | "desc";

interface ReposTableProps {
  repos: GitHubRepo[];
  pageSize?: number;
}

const COLUMNS: { key: SortKey; label: string; align?: "left" | "right" }[] = [
  { key: "name", label: "Repository", align: "left" },
  { key: "language", label: "Language", align: "left" },
  { key: "stargazers_count", label: "Stars", align: "right" },
  { key: "forks_count", label: "Forks", align: "right" },
  { key: "updated_at", label: "Updated", align: "right" },
];

/**
 * Stable color-per-language so the badge color matches the donut chart.
 * Hash the language name into the same palette index so both views agree.
 */
function langColor(lang: string | null): string {
  if (!lang) return "var(--color-text-muted)";
  let hash = 0;
  for (let i = 0; i < lang.length; i++)
    hash = (hash * 31 + lang.charCodeAt(i)) | 0;
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

/**
 * "23 days ago" / "2 hours ago" — cheap relative time formatter.
 * Avoids pulling in date-fns just for this.
 */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ReposTable({ repos, pageSize = 10 }: ReposTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("stargazers_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      // Same column → flip direction
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // New column → reset to descending (most useful default for numbers)
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0); // reset pagination when sort changes
  }

  // Sort + paginate. Memoized so re-renders from elsewhere don't re-sort.
  const sorted = useMemo(() => {
    const copy = [...repos];
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] ?? "";
      let bv: string | number = b[sortKey] ?? "";
      // Handle nulls (language can be null)
      if (av === null) av = "";
      if (bv === null) bv = "";
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return copy;
  }, [repos, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  if (repos.length === 0) {
    return (
      <section className="card p-8 text-center text-text-muted text-sm animate-fade-in">
        No repositories to show.
      </section>
    );
  }

  return (
    <section className="card animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-bg-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-base sm:text-lg text-text-primary tracking-tight">
            All repositories
          </h3>
          <p className="text-xs text-text-muted mt-0.5 font-mono">
            {sorted.length} {sorted.length === 1 ? "repo" : "repos"} · sorted by{" "}
            {COLUMNS.find((c) => c.key === sortKey)?.label.toLowerCase()}
          </p>
        </div>
      </div>

      {/* Table — horizontal scroll on small screens */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`
                      px-5 sm:px-6 py-2.5
                      text-[11px] uppercase tracking-wider font-semibold
                      cursor-pointer select-none
                      transition-colors duration-150
                      ${active ? "text-accent" : "text-text-muted hover:text-text-secondary"}
                      ${col.align === "right" ? "text-right" : "text-left"}
                      whitespace-nowrap
                    `}
                  >
                    <span
                      className={`
                        inline-flex items-center gap-1
                        ${col.align === "right" ? "flex-row-reverse" : ""}
                      `}
                    >
                      {col.label}
                      <SortIcon active={active} dir={sortDir} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((repo) => (
              <tr
                key={repo.id}
                className="
                  border-t border-bg-border
                  transition-colors duration-150
                  hover:bg-bg-elevated/60
                  group
                "
              >
                {/* Repo name */}
                <td className="px-5 sm:px-6 py-3 max-w-[260px]">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center gap-1.5
                      font-mono text-text-primary
                      transition-colors duration-150
                      hover:text-accent
                      truncate
                    "
                  >
                    <span className="truncate">{repo.name}</span>
                    <ExternalLink
                      className="
                        w-3 h-3 shrink-0 opacity-0
                        group-hover:opacity-100
                        transition-opacity duration-150
                      "
                    />
                  </a>
                  {repo.description && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {repo.description}
                    </p>
                  )}
                </td>

                {/* Language */}
                <td className="px-5 sm:px-6 py-3">
                  {repo.language ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: langColor(repo.language) }}
                      />
                      <span className="font-mono">{repo.language}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>

                {/* Stars */}
                <td className="px-5 sm:px-6 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-mono text-text-secondary tabular-nums">
                    <Star className="w-3.5 h-3.5 text-text-muted" />
                    {repo.stargazers_count}
                  </span>
                </td>

                {/* Forks */}
                <td className="px-5 sm:px-6 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-mono text-text-secondary tabular-nums">
                    <GitFork className="w-3.5 h-3.5 text-text-muted" />
                    {repo.forks_count}
                  </span>
                </td>

                {/* Updated */}
                <td className="px-5 sm:px-6 py-3 text-right">
                  <span className="font-mono text-xs text-text-muted whitespace-nowrap">
                    {timeAgo(repo.updated_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 sm:px-6 py-3 border-t border-bg-border flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-text-muted tabular-nums">
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="
                p-1.5 rounded-md
                text-text-secondary
                transition-all duration-150
                hover:text-text-primary hover:bg-bg-elevated
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
                active:scale-95
              "
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="
                p-1.5 rounded-md
                text-text-secondary
                transition-all duration-150
                hover:text-text-primary hover:bg-bg-elevated
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
                active:scale-95
              "
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Sort indicator that swaps icon and color based on whether the column is active.
 */
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <ArrowUpDown className="w-3 h-3 opacity-50" strokeWidth={2.25} />;
  }
  return dir === "asc" ? (
    <ArrowUp className="w-3 h-3" strokeWidth={2.5} />
  ) : (
    <ArrowDown className="w-3 h-3" strokeWidth={2.5} />
  );
}
