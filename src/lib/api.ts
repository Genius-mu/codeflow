import axios, { AxiosError } from "axios";
import {
  GitHubUserSchema,
  GitHubReposSchema,
  GitHubCommitsSchema,
  ContributionsResponseSchema,
  type GitHubUser,
  type GitHubRepo,
  type GitHubCommit,
  type ContributionCalendar,
} from "./schemas";
import { getStoredToken } from "./oauth";

/**
 * Custom error class — gives us structured info instead of cryptic axios errors.
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
 * Pre-configured axios instance for the REST API.
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
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Translates raw axios errors into our typed GitHubAPIError.
 *
 * Detecting rate limits is tricky because:
 * - Anonymous requests sometimes don't include x-ratelimit-remaining at all
 * - The header value isn't always 0 even when GitHub is throttling
 * - GitHub puts the actual reason in the response body's `message` field
 *
 * So we check both the header AND the body message for rate-limit indicators.
 */
function handleError(error: unknown): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const remainingRaw = error.response?.headers["x-ratelimit-remaining"];
    const remaining =
      remainingRaw !== undefined ? Number(remainingRaw) : undefined;
    const bodyMessage =
      (error.response?.data as { message?: string } | undefined)?.message ?? "";

    if (status === 404) {
      throw new GitHubAPIError("User not found", 404);
    }

    if (status === 403) {
      // Rate limit: either the header says 0, or GitHub's message tells us
      const isRateLimit =
        remaining === 0 ||
        /rate limit/i.test(bodyMessage) ||
        /api rate limit/i.test(bodyMessage);

      if (isRateLimit) {
        throw new GitHubAPIError(
          "Rate limit exceeded. Sign in with GitHub to increase your limit.",
          403,
          0,
        );
      }
      // Some other 403 (abuse detection, secondary limit, permissions)
      throw new GitHubAPIError(
        bodyMessage || "Access forbidden",
        403,
        remaining,
      );
    }

    if (status === 401) {
      throw new GitHubAPIError("Invalid or expired GitHub token", 401);
    }

    throw new GitHubAPIError(
      bodyMessage || error.message || "Request failed",
      status,
      remaining,
    );
  }
  throw new GitHubAPIError("Unexpected error");
}

/**
 * Fetch a user's profile.
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
 *
 * Returns [] for any "expected" failure — empty repo (409), abuse detection
 * (403 with remaining), repo gone (404). We don't want one bad repo polluting
 * the console for the user; just skip it silently and move on.
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
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      // Empty repo, gone, or abuse-detection backoff → skip silently
      if (
        status === 409 ||
        status === 404 ||
        status === 403 ||
        status === 429
      ) {
        return [];
      }
    }
    handleError(err);
  }
}

/**
 * Run an array of async tasks with controlled concurrency.
 *
 * Why we need this: firing 80 parallel requests at GitHub triggers their
 * secondary rate limiter and most fail. 5 at a time keeps us well under
 * any abuse threshold while still being plenty fast.
 *
 * This is a tiny custom helper — pulling in p-limit or similar would be
 * overkill for one usage site.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const i = cursor++;
      try {
        const value = await tasks[i]();
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  // Spawn N workers that pull tasks off the shared cursor
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

/**
 * Fetch commits across the user's most recently active repos.
 *
 * Two key throttles vs. naive Promise.allSettled:
 * - Cap repo count at 30 (sorted by recency from fetchRepos). Beyond that,
 *   commits are unlikely to fall in the last 30 days anyway.
 * - Run with concurrency=5 instead of all-at-once. Avoids GitHub's
 *   secondary rate limit (the 403 storm).
 */
export async function fetchAllRecentCommits(
  username: string,
  repos: GitHubRepo[],
  daysBack: number = 30,
): Promise<GitHubCommit[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Skip forks, then keep only the 30 most-recently-updated. Repos already
  // come back sorted by `updated` from fetchRepos, so slice() is enough.
  const ownRepos = repos.filter((r) => !r.fork).slice(0, 30);

  const tasks = ownRepos.map(
    (repo) => () => fetchRepoCommits(username, repo.name, since),
  );

  const results = await runWithConcurrency(tasks, 5);

  return results
    .filter(
      (r): r is PromiseFulfilledResult<GitHubCommit[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);
}

/* ───────────── GraphQL: contribution calendar ───────────── */

const CONTRIBUTIONS_QUERY = `
  query ($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetch the contribution calendar via GraphQL.
 *
 * Auth: REQUIRES a token — GraphQL has no anonymous access.
 */
export async function fetchContributions(
  username: string,
): Promise<ContributionCalendar> {
  const token = getStoredToken();
  if (!token) {
    throw new GitHubAPIError("Sign in to see contribution data", 401);
  }

  try {
    const { data } = await axios.post(
      "https://api.github.com/graphql",
      {
        query: CONTRIBUTIONS_QUERY,
        variables: { username },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    const parsed = ContributionsResponseSchema.parse(data);

    if (parsed.errors?.length) {
      throw new GitHubAPIError(parsed.errors[0].message, 400);
    }
    if (!parsed.data?.user) {
      throw new GitHubAPIError("User not found", 404);
    }

    return parsed.data.user.contributionsCollection.contributionCalendar;
  } catch (err) {
    if (err instanceof GitHubAPIError) throw err;
    handleError(err);
  }
}
