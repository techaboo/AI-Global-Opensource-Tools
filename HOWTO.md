# HOWTO

Practical walkthroughs that don't fit in the README's quick-start.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000, hot-reloading
npm run lint      # eslint
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the production build locally
```

`npm run build` is the single command that both typechecks (`tsc -b`) and bundles — CI runs
exactly this, plus lint and `npm audit`. Run it locally before pushing if you want to catch
what CI would catch.

## Using the command palette

Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) anywhere in the app, or click the search bar's
`⌘K` button. It fuzzy-searches all 464 tools by name/org/tagline, and also lists actions
(toggle theme, show favorites, sync GitHub, reset filters) and every view/category as
jump targets. Built on the `cmdk` package — see `src/components/CommandPalette.tsx`.

## Setting up a GitHub token safely

Two independent tokens exist in this project — don't mix them up:

1. **In-app token** (optional, for visitors): the 🔑 button in the header. Stored only in
   `localStorage`, sent only to `api.github.com`. Raises the live-sync rate limit from 60 to
   5,000 requests/hour. Never required for normal use.
2. **Local dev convenience token**: create a gitignored `.env` with
   `VITE_GITHUB_TOKEN=github_pat_...` to skip pasting it into the UI while developing. This is
   read **only** when `import.meta.env.DEV` is true (see `src/hooks/useGitHubSync.ts`) — a
   production build never inlines it, confirmed by grepping the built bundle for the variable
   name. Still, don't set this env var in a shell you might later use to run a production build
   by mistake, and never commit `.env`.
3. **CI/automation token** (`KIMI_GITHUB_API` repo secret): used only by
   `.github/workflows/refresh-stars.yml` server-side. Never reaches the browser.

## Running CI locally

`.github/workflows/ci.yml` runs on every push/PR:

```bash
npm ci
npm run lint
npm run check-duplicates
npm audit --audit-level=high
npm run build
```

Run the same four commands locally to reproduce a CI failure exactly.

## Deploying

No hosting platform is wired up yet (no `vercel.json`/`netlify.toml`/Pages workflow). The app
is a static SPA — `npm run build` produces a fully static `dist/` you can serve from any static
host (Vercel, Netlify, GitHub Pages, S3+CloudFront, etc.). Two things to set up per-host once
you pick one:

- A **rewrite/fallback rule** so client-side routes (e.g. `?view=table&cmp=...`) don't 404 on
  refresh — this app uses `react-router`'s `BrowserRouter` with query-string state, so it needs
  the host to always serve `index.html` for unknown paths (or switch to `HashRouter` if the host
  can't do rewrites).
- Optionally, real HTTP security headers (`frame-ancestors`, `Reporting-Endpoints`) — the
  build already ships a `<meta>` Content-Security-Policy (see `vite.config.ts`'s `injectCsp`
  plugin), but two CSP directives are only valid as real headers, not `<meta>`, per spec. See
  `SECURITY.md`.

## Adding/updating catalog entries

The dataset is `src/data/tools.ts` — one typed `AITool` object per entry (see
`src/types/index.ts` for the shape). Required fields: `id`, `name`, `org`, `cat`, `tagline`,
`desc`, `license`, `lang`, `stars`, `tags`, `status`, `year`. Include `repo` as `owner/name`
whenever a public GitHub repo exists — that's what powers live sync, the weekly snapshot, and
the avatar shown everywhere.

**Before adding an entry, check it isn't already in the file** — search `src/data/tools.ts` by
`repo` (most reliable) or `name`, or just run:

```bash
npm run check-duplicates
```

This runs `scripts/check-duplicates.mjs`, which fails (non-zero exit, listed line numbers) if
any two entries share an `id` or a `repo` (case-insensitive). It also runs in CI on every push,
so a duplicate can't merge silently — including from any automated/scheduled agent that adds
entries and pushes on its own. A duplicate `id` would otherwise silently produce two cards with
the same React key; a duplicate `repo` under a different `id` would just look like two separate
tools in the UI, with no error anywhere.
