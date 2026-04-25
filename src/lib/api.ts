import axios, { AxiosError } from "axios";
import {
  GitHubUserSchema,
  GitHubReposSchema,
  GitHubCommitsSchema,
  type GitHubUser,
  type GitHubRepo,
  type GitHubCommit,
} from "./schemas";

/**
 * Custom error class — gives us structured info instead of cryptic axios errors.
 * Components can switch on `status` to show different UI (404 → "user not found", etc.).
 */
export class GitHubAPIError extends Error {
  status?: number;
  rateLimitRemaining?: number;

  constructor(message: string, status?: number, rateLimitRemaining?: number) {
    super(message);
    this.name = "GitHubAPIError";
    this.status = status;
    this.rateLimitRemaining = rateLimitRemaining;
  }
}

/**
 * Reads the optional GitHub token from localStorage.
 * No token → 60 requests/hour. With token → 5000/hour.
 * Set in browser console: localStorage.setItem('github_token', 'ghp_...')
 */
function getToken(): string | null {
  return localStorage.getItem("github_token");
}

/**
 * Pre-configured axios instance.
 * - Base URL set once
 * - Auth header injected per-request via interceptor (so it picks up token changes live)
 * - JSON accept header per GitHub's recommendation
 */
const client = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Translates raw axios errors into our typed GitHubAPIError.
 * Centralized here so every API function gets the same friendly errors.
 */
function handleError(error: unknown): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const remaining = Number(error.response?.headers["x-ratelimit-remaining"]);

    if (status === 404) {
      throw new GitHubAPIError("User not found", 404);
    }
    if (status === 403 && remaining === 0) {
      throw new GitHubAPIError(
        "Rate limit exceeded. Add a GitHub token to increase your limit.",
        403,
        0,
      );
    }
    if (status === 401) {
      throw new GitHubAPIError("Invalid GitHub token", 401);
    }
    throw new GitHubAPIError(
      error.message || "Request failed",
      status,
      remaining,
    );
  }
  throw new GitHubAPIError("Unexpected error");
}

/**
 * Fetch a user's profile.
 * GET /users/{username}
 */
export async function fetchUser(username: string): Promise<GitHubUser> {
  try {
    const { data } = await client.get(`/users/${username}`);
    return GitHubUserSchema.parse(data);
  } catch (err) {
    handleError(err);
  }
}

/**
 * Fetch a user's public repositories.
 * GET /users/{username}/repos?per_page=100&sort=updated
 *
 * 100 is GitHub's max page size. For users with >100 repos we'd need pagination,
 * but for a portfolio dashboard 100 most-recently-updated is plenty.
 */
export async function fetchRepos(username: string): Promise<GitHubRepo[]> {
  try {
    const { data } = await client.get(`/users/${username}/repos`, {
      params: { per_page: 100, sort: "updated" },
    });
    return GitHubReposSchema.parse(data);
  } catch (err) {
    handleError(err);
  }
}

/**
 * Fetch recent commits for a single repo.
 * GET /repos/{owner}/{repo}/commits?since={date}
 *
 * `since` filters server-side — much faster than fetching everything and filtering client-side.
 */
export async function fetchRepoCommits(
  owner: string,
  repo: string,
  since: Date,
): Promise<GitHubCommit[]> {
  try {
    const { data } = await client.get(`/repos/${owner}/${repo}/commits`, {
      params: { since: since.toISOString(), per_page: 100 },
    });
    return GitHubCommitsSchema.parse(data);
  } catch (err) {
    // Empty repos return 409. Not a real error — just no commits yet.
    if (err instanceof AxiosError && err.response?.status === 409) {
      return [];
    }
    handleError(err);
  }
}

/**
 * Fetch commits across ALL of a user's repos in parallel.
 * Used by the "commits over time" chart.
 *
 * Why Promise.allSettled vs Promise.all:
 * One repo failing (deleted, archived, permissions) shouldn't kill the whole chart.
 * We collect what we can and ignore the rest.
 */
export async function fetchAllRecentCommits(
  username: string,
  repos: GitHubRepo[],
  daysBack: number = 30,
): Promise<GitHubCommit[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Skip forks — they pollute the activity chart with commits the user didn't write.
  const ownRepos = repos.filter((r) => !r.fork);

  const results = await Promise.allSettled(
    ownRepos.map((repo) => fetchRepoCommits(username, repo.name, since)),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<GitHubCommit[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);
}
