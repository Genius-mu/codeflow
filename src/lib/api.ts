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
 *
 * Note: the GraphQL endpoint REQUIRES a token — there's no anonymous access.
 * The contributions feature gracefully shows a "needs token" empty state if missing.
 */
function getToken(): string | null {
  return localStorage.getItem("github_token");
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
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Translates raw axios errors into our typed GitHubAPIError.
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
    if (err instanceof AxiosError && err.response?.status === 409) {
      return [];
    }
    handleError(err);
  }
}

/**
 * Fetch commits across ALL of a user's repos in parallel.
 */
export async function fetchAllRecentCommits(
  username: string,
  repos: GitHubRepo[],
  daysBack: number = 30,
): Promise<GitHubCommit[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

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

/* ───────────── GraphQL: contribution calendar ───────────── */

/**
 * The GraphQL query — kept as a plain string.
 * GitHub's contributionsCollection returns the calendar grouped by week,
 * which is convenient for rendering (each week = one column in the heatmap).
 */
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
 * Why GraphQL: the contribution graph data isn't exposed on the REST API.
 * Why this is the only GraphQL call in CodeFlow: every other endpoint we use
 * is cleaner via REST. Mixing styles only because the data demands it.
 *
 * Auth: REQUIRES a token — GraphQL has no anonymous access. We surface that
 * with a typed error so the UI can show a clear "add token" prompt.
 */
export async function fetchContributions(
  username: string,
): Promise<ContributionCalendar> {
  const token = getToken();
  if (!token) {
    throw new GitHubAPIError(
      "GitHub token required for contribution data",
      401,
    );
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

    // GraphQL puts errors in the body, not in HTTP status — handle them here
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
