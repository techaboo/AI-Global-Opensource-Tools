# Security

## Trust model

Open Source AI Atlas is a **fully static, client-only** single-page app. There is no backend
server and no database — everything runs in the visitor's browser.

- The catalog (`src/data/tools.ts`) is a bundled, read-only dataset. No user input is ever
  written back to it.
- The only network calls the app makes are to `https://api.github.com` (public repo stats)
  and to its own same-origin `public/live-snapshot.json`.
- An optional GitHub personal access token can be pasted into the app to raise the sync rate
  limit. It is stored **only** in the browser's `localStorage`, is sent **only** to
  `api.github.com`, and is never transmitted anywhere else. It is not required for normal use.
- A separate token (repo secret `KIMI_GITHUB_API`) is used server-side by the scheduled
  GitHub Actions workflow (`.github/workflows/refresh-stars.yml`) to regenerate
  `public/live-snapshot.json`. That token never reaches the browser.
- `VITE_GITHUB_TOKEN` (an optional local `.env` convenience for development) is read only when
  `import.meta.env.DEV` is true, so it is never inlined into a production build.

## Reporting a vulnerability

Please use GitHub's private [Security Advisories](../../security/advisories/new) feature for
this repository rather than opening a public issue. This lets us assess and fix the report
before it's disclosed publicly.

## Scope notes

- Because the token field lives in client-side `localStorage`, a successful XSS against this
  app could read it. There is no `dangerouslySetInnerHTML`, `eval`, or unsanitized HTML
  injection anywhere in the codebase today — if you find one, please report it.
- `npm audit` is run in CI (see `.github/workflows/ci.yml`) on every push and pull request.
- If you deploy your own fork behind a real HTTP server (Vercel/Netlify/Pages/etc.), consider
  adding `frame-ancestors` and a `Reporting-Endpoints`/`report-to` CSP directive at the host
  level — the `<meta>`-tag CSP shipped in the production build (see `vite.config.ts`) cannot
  express those two directives per the CSP spec.
