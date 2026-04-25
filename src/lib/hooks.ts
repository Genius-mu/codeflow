import { useQuery } from "@tanstack/react-query";
import { fetchUser, fetchRepos, fetchAllRecentCommits } from "./api";
import type { GitHubRepo } from "./schemas";

/**
 * React Query cache key prefixes.
 * Keys are arrays — React Query uses them as cache identifiers and as
 * dependency hints for refetching. Centralizing them prevents typos
 * and makes invalidation predictable.
 */
export const queryKeys = {
  user: (username: string) => ["user", username] as const,
  repos: (username: string) => ["repos", username] as const,
  commits: (username: string, daysBack: number) =>
    ["commits", username, daysBack] as const,
};

/**
 * Default stale time — how long data stays "fresh" before refetching.
 * 5 minutes is a sweet spot for GitHub data: not so short that we burn
 * rate limit, not so long that the dashboard feels stale.
 */
const FIVE_MINUTES = 5 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

/**
 * Fetch a GitHub user's profile.
 * Disabled when username is empty — prevents firing on initial render
 * before the user has typed anything.
 */
export function useUser(username: string) {
  return useQuery({
    queryKey: queryKeys.user(username),
    queryFn: () => fetchUser(username),
    enabled: username.length > 0,
    staleTime: FIVE_MINUTES,
    retry: (failureCount, error) => {
      // Don't retry on 404 — user genuinely doesn't exist, retrying won't help.
      if ((error as { status?: number })?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Fetch a user's public repos.
 * Same enabled/retry pattern as useUser.
 *
 * staleTime is longer (10 min) — repos change less often than profile metadata.
 */
export function useRepos(username: string) {
  return useQuery({
    queryKey: queryKeys.repos(username),
    queryFn: () => fetchRepos(username),
    enabled: username.length > 0,
    staleTime: TEN_MINUTES,
    retry: (failureCount, error) => {
      if ((error as { status?: number })?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Fetch all recent commits across the user's repos.
 *
 * This one is special: it depends on the repos query.
 * - We pass `repos` as input
 * - The hook is `enabled` only when repos have loaded
 * - The query key includes the username AND daysBack so changing
 *   the time window triggers a fresh fetch
 *
 * This is the recommended React Query pattern for "dependent queries":
 * https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries
 */
export function useCommits(
  username: string,
  repos: GitHubRepo[] | undefined,
  daysBack: number = 30,
) {
  return useQuery({
    queryKey: queryKeys.commits(username, daysBack),
    queryFn: () => fetchAllRecentCommits(username, repos ?? [], daysBack),
    // Only fire when we have a username AND the repos list is loaded
    enabled: username.length > 0 && Array.isArray(repos) && repos.length > 0,
    staleTime: FIVE_MINUTES,
    // Commits across many repos = many requests. Keep this lower-priority
    // by not retrying aggressively.
    retry: 1,
  });
}
