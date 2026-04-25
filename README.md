# CodeFlow

A GitHub analytics dashboard built with React, TypeScript, and Tailwind v4. Search any GitHub user and explore their repositories, language distribution, and commit activity in a clean dark interface.

[**Live demo →**](https://your-url.vercel.app) <!-- paste your Vercel URL after deploy -->

## Features

- Search any public GitHub user
- Profile overview with bio, followers, location, and links
- Summary metrics: total repos, stars, forks, top language
- Donut chart for language distribution
- Line chart for commit activity over the last 30 days
- Filter by language, minimum stars, and fork status
- Loading skeletons, error states, and empty states throughout
- Optional GitHub token support (60 → 5000 requests/hour)

## Tech stack

| Layer         | Choice               | Why                                      |
| ------------- | -------------------- | ---------------------------------------- |
| Framework     | React 18             | Industry standard                        |
| Build         | Vite                 | Instant HMR, fast cold start             |
| Language      | TypeScript           | Catch errors at compile time             |
| Styling       | Tailwind v4          | Utility-first, theme tokens via `@theme` |
| Data fetching | TanStack React Query | Caching, retries, stale-while-revalidate |
| State         | Zustand              | Lightweight global state, no boilerplate |
| Validation    | Zod                  | Runtime type safety for API responses    |
| Charts        | Recharts             | Composable, themeable                    |
| HTTP          | Axios                | Interceptors for auth, structured errors |
| Icons         | Lucide React         | Consistent, customizable                 |

## Architecture

```
src/
├── lib/                    Core data layer (no React, easy to test)
│   ├── api.ts              Axios client + GitHub endpoints
│   ├── schemas.ts          Zod schemas + inferred types
│   ├── store.ts            Zustand store (search + filters + UI)
│   ├── hooks.ts            React Query hooks
│   └── utils.ts            Pure data transformations
│
├── components/             Reusable UI pieces
│   ├── Header.tsx          Search + brand
│   ├── Filters.tsx         Language chips + slider + toggle
│   ├── MetricCard.tsx      Animated stat card
│   └── ChartContainer.tsx  Chart wrapper with loading/error/empty states
│
├── App.tsx                 Dashboard composition
├── main.tsx                Entry + React Query provider
└── index.css               Theme tokens, base styles, custom CSS
```

Validation runs at the API boundary, so components only ever see clean, typed data. Pure transforms in `utils.ts` are framework-free and testable.

## Getting started

Prerequisites: Node 18+ and npm.

```bash
git clone https://github.com/YOUR_USERNAME/codeflow.git
cd codeflow
npm install
npm run dev
```

Open http://localhost:5173.

## Optional: GitHub token

Without a token, GitHub allows 60 API requests per hour from your IP. With a token, the limit jumps to 5000/hour.

1. Create a token at [GitHub → Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens). No scopes are needed for public data.
2. In your browser console on the deployed site:

```js
localStorage.setItem("github_token", "ghp_YOUR_TOKEN_HERE");
```

3. Refresh the page.

The token stays in your browser's localStorage and is never sent anywhere except `api.github.com`.

## Build for production

```bash
npm run build
npm run preview
```

The `dist/` folder contains the static site, ready to deploy anywhere.

## Deployment

Deployed on Vercel. Any static host works — Netlify, Cloudflare Pages, GitHub Pages, S3.

## License

MIT
