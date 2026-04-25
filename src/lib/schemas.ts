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
 * TypeScript types — inferred from schemas so types and validation never drift.
 * Import these anywhere you need the data shape.
 */
export type GitHubUser = z.infer<typeof GitHubUserSchema>;
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;
