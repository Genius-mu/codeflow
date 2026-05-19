import { z } from "zod";

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

export const GitHubReposSchema = z.array(GitHubRepoSchema);
export const GitHubCommitsSchema = z.array(GitHubCommitSchema);

/**
 * Lightweight user — what /users/{user}/followers returns.
 * The list endpoint returns a compact subset, not the full profile shape.
 */
export const GitHubFollowerSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().url(),
  html_url: z.string().url(),
});

export const GitHubFollowersSchema = z.array(GitHubFollowerSchema);

export const ContributionDaySchema = z.object({
  date: z.string(),
  contributionCount: z.number(),
  color: z.string(),
});

export const ContributionCalendarSchema = z.object({
  totalContributions: z.number(),
  weeks: z.array(
    z.object({
      contributionDays: z.array(ContributionDaySchema),
    }),
  ),
});

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

export type GitHubUser = z.infer<typeof GitHubUserSchema>;
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;
export type GitHubFollower = z.infer<typeof GitHubFollowerSchema>;
export type ContributionDay = z.infer<typeof ContributionDaySchema>;
export type ContributionCalendar = z.infer<typeof ContributionCalendarSchema>;
