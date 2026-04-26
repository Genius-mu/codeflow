import { useQuery } from "@tanstack/react-query";
import {
  fetchUser,
  fetchRepos,
  fetchAllRecentCommits,
  fetchContributions,
} from "./api";
import type { GitHubRepo } from "./schemas";

/**
 * React Query cache key prefixes.
 */
export const queryKeys = {
  user: (username: string) => ["user", username] as const,
  repos: (username: string) => ["repos", username] as const,
  commits: (username: string, daysBack: number) =>
    ["commits", username, daysBack] as const,
  contributions: (username: string) => ["contributions", username] as const,
};

const FIVE_MINUTES = 5 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function useUser(username: string) {
  return useQuery({
    queryKey: queryKeys.user(username),
    queryFn: () => fetchUser(username),
    enabled: username.length > 0,
    staleTime: FIVE_MINUTES,
    retry: (failureCount, error) => {
      if ((error as { status?: number })?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

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

export function useCommits(
  username: string,
  repos: GitHubRepo[] | undefined,
  daysBack: number = 30,
) {
  return useQuery({
    queryKey: queryKeys.commits(username, daysBack),
    queryFn: () => fetchAllRecentCommits(username, repos ?? [], daysBack),
    enabled: username.length > 0 && Array.isArray(repos) && repos.length > 0,
    staleTime: FIVE_MINUTES,
    retry: 1,
  });
}

/**
 * Fetch the contribution calendar.
 *
 * staleTime is longest of all queries (15 min) — contribution data updates
 * relatively slowly (once per push event), so we cache aggressively.
 *
 * No retries on auth errors (401) — without a token, retrying just spams the API.
 */
export function useContributions(username: string) {
  return useQuery({
    queryKey: queryKeys.contributions(username),
    queryFn: () => fetchContributions(username),
    enabled: username.length > 0,
    staleTime: FIFTEEN_MINUTES,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 404) return false;
      return failureCount < 1;
    },
  });
}
