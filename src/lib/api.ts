import axios, { AxiosError } from "axios";
import {
  GitHubUserSchema,
  GitHubReposSchema,
  ContributionsResponseSchema,
  type GitHubUser,
  type GitHubRepo,
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
 * This single request returns daily contribution counts for the entire last
 * year — feeds BOTH the heatmap AND the 30-day commit chart in `utils.ts`.
 * No more per-repo commit fetching. One request, all the data.
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
