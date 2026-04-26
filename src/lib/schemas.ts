import { z } from "zod";

/**
 * GitHub User schema
 * Validates the response from GET /users/{username}
 * Only fields we actually use — keeps validation cheap and types clean.
 */
export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().url(),
  html_url: z.string().url(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  blog: z.string().nullable(),
  public_repos: z.number(),
  public_gists: z.number(),
  followers: z.number(),
  following: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * GitHub Repository schema
 * Validates each item from GET /users/{username}/repos
 */
export const GitHubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  html_url: z.string().url(),
  description: z.string().nullable(),
  fork: z.boolean(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  size: z.number(),
  default_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  archived: z.boolean(),
  visibility: z.string().optional(),
});

/**
 * GitHub Commit schema (simplified)
 * Validates items from GET /repos/{owner}/{repo}/commits
 */
export const GitHubCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    author: z.object({
      name: z.string(),
      email: z.string(),
      date: z.string(),
    }),
    message: z.string(),
  }),
  html_url: z.string().url(),
});

/**
 * Array schemas — used to validate full list responses at once.
 */
export const GitHubReposSchema = z.array(GitHubRepoSchema);
export const GitHubCommitsSchema = z.array(GitHubCommitSchema);

/**
 * Contribution calendar — from the GraphQL API.
 *
 * Shape returned by the GraphQL query:
 *   user.contributionsCollection.contributionCalendar = {
 *     totalContributions: number,
 *     weeks: [{ contributionDays: [{ date, contributionCount, color }] }]
 *   }
 *
 * We flatten this into a simpler shape (an array of days) in the API layer
 * because the nested weeks structure is awkward to render with.
 */
export const ContributionDaySchema = z.object({
  date: z.string(), // "YYYY-MM-DD"
  contributionCount: z.number(),
  color: z.string(), // GitHub returns its own hex but we'll override with our palette
});

export const ContributionCalendarSchema = z.object({
  totalContributions: z.number(),
  weeks: z.array(
    z.object({
      contributionDays: z.array(ContributionDaySchema),
    }),
  ),
});

/**
 * The full GraphQL response wrapper.
 * GraphQL always responds with `{ data: { ... } }` or `{ errors: [...] }`.
 */
export const ContributionsResponseSchema = z.object({
  data: z
    .object({
      user: z
        .object({
          contributionsCollection: z.object({
            contributionCalendar: ContributionCalendarSchema,
          }),
        })
        .nullable(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * TypeScript types — inferred from schemas so types and validation never drift.
 */
export type GitHubUser = z.infer<typeof GitHubUserSchema>;
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;
export type ContributionDay = z.infer<typeof ContributionDaySchema>;
export type ContributionCalendar = z.infer<typeof ContributionCalendarSchema>;
