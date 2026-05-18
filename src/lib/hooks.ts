import { useQuery } from "@tanstack/react-query";
import { fetchUser, fetchRepos, fetchContributions } from "./api";

/**
 * React Query cache key prefixes.
 */
export const queryKeys = {
  user: (username: string) => ["user", username] as const,
  repos: (username: string) => ["repos", username] as const,
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

/**
 * Fetch the contribution calendar.
 *
 * Powers BOTH the heatmap and the 30-day commit chart — one request, both
 * visualizations. Massive reduction in API usage vs. fetching commits per-repo.
 *
 * staleTime is longest of all queries (15 min) — contribution data updates
 * relatively slowly, so we cache aggressively.
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
