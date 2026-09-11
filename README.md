# Open Source AI Atlas

**The living map of open-source AI** — a reactive dashboard that catalogs, filters, and dynamically tracks **469 open-source AI tools across 27 categories**, from foundation models to robotics.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06b6d4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![CI](https://github.com/techaboo/AI-Global-Opensource-Tools/actions/workflows/ci.yml/badge.svg)

---

## Overview

The open-source AI ecosystem moves fast — new models, agent frameworks, and inference engines ship weekly, and yesterday's leaders get archived. The AI Atlas is a single-pane-of-glass catalog built from hands-on ecosystem research, designed to stay current through **live GitHub data syncing**.

Every entry is enriched with: organization, license, primary language, release year, star count, tags, health status (active / maintenance / archived), and a researched description.

### Categories covered (27)

Foundation Models · Vision-Language Models · Inference & Serving · Chat & Frontends · Agent Frameworks · Coding Agents · Personal Assistants · Browser & Computer Use · RAG, Memory & Knowledge · Search & Web Data · Vector Databases · Workflow & Low-Code · Image Generation · Video Generation · 3D & Spatial · Audio & Speech · Fine-tuning & Training · Frameworks & Libraries · MLOps & Gateways · Eval & Observability · Safety & Guardrails · Data & Labeling · Computer Vision · Document AI & OCR · Prompts & Learning · MCP Ecosystem · Robotics & RL

## Features

- **Command palette** — `Cmd/Ctrl+K` to fuzzy-jump to any tool, switch views, toggle theme, sync, or reset filters without leaving the keyboard
- **Instant search** — full-text across names, orgs, descriptions, tags, and licenses (press `/` to focus)
- **Rich filtering** — by category, license, language, and project health status, with one-click reset
- **Favorites** — star any tool, then filter to just your favorites; persisted locally with a count badge in the header
- **Four views** — card grid, sortable table, analytics dashboard, and category comparison
- **Analytics** — tools-per-category (click-to-filter), top-12 by stars, license mix, project health, language breakdown, and release-year timeline (Recharts)
- **Category compare** — side-by-side license mix, language mix, health, and top tools for two or three categories (`?view=compare&cmp=models,inference`)
- **Star-history sparklines** — every card, table row, and detail panel shows a compact trend. Weekly CI samples accumulate in `public/live-snapshot.json`; until enough samples exist, the UI draws a lightweight year→current approximation so the chart works offline
- **Export** — download the currently filtered list (search, category, license, language, status, favorites) as CSV or JSON from the filter bar
- **Live GitHub sync** — batch-refresh stars/forks/issues for the visible list via the GitHub REST API, with concurrency control, progress bar, rate-limit detection, and per-repo "fetch live" in the detail panel. Results are cached in `localStorage` and marked with a LIVE badge
- **Optional GitHub token** — paste a read-only PAT to raise the rate limit from 60 to 5,000 req/hr and sync the whole catalog at once; stored only in your browser
- **Shareable URLs** — filters, sort order, view mode, and the favorites toggle sync to the address bar, so any view is a link you can send
- **Activity sort** — "Recently pushed" orders tools by last commit activity using synced `pushedAt` data
- **Detail panels** — slide-out sheets with stats, metadata, tags, favorite toggle, and direct repository links
- **Dark / light theme** — dark by default, one-click toggle, remembered across sessions
- **Automated weekly refresh** — a GitHub Actions workflow ([`.github/workflows/refresh-stars.yml`](.github/workflows/refresh-stars.yml)) regenerates `public/live-snapshot.json` every Monday using a repo secret, so live stats stay fresh even without manual sync
- **Per-tool avatars** — each card, table row, and detail panel shows the repo owner's GitHub avatar (first-party `github.com/<owner>.png`, no third-party favicon service), with a skeleton while loading and a category-icon fallback
- **Fully responsive** — category sidebar on desktop, chip rail on mobile

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 7 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| Charts | Recharts |
| Icons | lucide-react |
| Live data | GitHub REST API (60 req/hr unauthenticated, 5,000 with an optional local token) |

## Getting started

```bash
git clone https://github.com/techaboo/AI-Global-Opensource-Tools.git
cd AI-Global-Opensource-Tools
npm install
npm run dev
```

Then open http://localhost:3000 (see [`vite.config.ts`](vite.config.ts)).

### Build for production

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

See [HOWTO.md](HOWTO.md) for a fuller walkthrough (command palette, safe token setup, CI, deploying) and [SECURITY.md](SECURITY.md) for the trust model.

## Project structure

```
src/
├── App.tsx                  # Dashboard shell: state, filtering, sorting, layout
├── main.tsx                 # Entry point
├── index.css                # Tailwind + theme tokens
├── data/
│   └── tools.ts             # The catalog: 469 tools, 27 categories (typed dataset)
├── types/index.ts           # AITool, Category, LiveRepoData, StarPoint types
├── hooks/
│   └── useGitHubSync.ts     # Live GitHub sync: concurrency, caching, rate limits
├── lib/
│   ├── format.ts            # Star formatting, time-ago, license colors
│   ├── starHistory.ts       # Sparkline samples + year→now approximation
│   ├── compare.ts           # Compare-mode URL helpers
│   ├── export.ts            # Filtered CSV/JSON download
│   └── utils.ts             # cn() helper
└── components/
    ├── Header.tsx           # Search, sync button + progress, theme toggle
    ├── CategoryNav.tsx      # Category sidebar with counts
    ├── StatsBar.tsx         # Headline metrics
    ├── FilterBar.tsx        # Sort / license / language / status / view / export
    ├── CommandPalette.tsx   # Cmd/Ctrl+K palette: jump to tool/view/category, actions
    ├── ToolCard.tsx         # Grid cards + sparkline
    ├── ToolTable.tsx        # Virtualized (react-window) table view + sparkline
    ├── ToolAvatar.tsx       # Owner avatar with skeleton + category-icon fallback
    ├── ToolDetail.tsx       # Slide-out detail sheet + per-repo live fetch
    ├── Analytics.tsx        # Six-chart analytics view
    ├── CompareView.tsx      # Side-by-side category comparison
    ├── Sparkline.tsx        # Lightweight SVG star-history chart
    └── ui/                  # shadcn/ui primitives used by the app
```

## Data & freshness model

- The bundled star counts are a **labeled research snapshot** (September 2026) so the app works fully offline.
- **Sync GitHub** refreshes live figures for the currently filtered list (up to 60 repos per pass unauthenticated; effectively unlimited with a token). Live values override snapshots everywhere — cards, table, charts, and headline stats.
- Synced data is cached in the browser's `localStorage` only; it does not persist across devices.
- A weekly GitHub Actions workflow refreshes `public/live-snapshot.json` for all ~469 catalog repos that have a `repo` field and commits it back to the branch the workflow ran on (the Monday schedule always uses the default branch), so the deployed site always boots with fresh stats. Each run also appends one star-history sample per repo (capped at 52) for sparklines.

### Setting up the automated refresh

1. Create a [fine-grained personal access token](https://github.com/settings/tokens) — public-repo read access is enough (no special scopes needed for public data).
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**, name it `KIMI_GITHUB_API` (or edit the workflow to use your own secret name).
3. Done — the workflow runs every Monday at 06:00 UTC, or manually via **Actions → Refresh live GitHub stats → Run workflow**.
4. Locally: `GITHUB_TOKEN=<token> npm run fetch-stars` (or `KIMI_GITHUB_API`) writes `public/live-snapshot.json`. Never commit a token.

The workflow **commits the snapshot to the branch it ran on** (schedule = `main`). If `main` is protected, switch the last step to open a PR or allow `github-actions[bot]` to push. The first merge of `.github/workflows/refresh-stars.yml` needs a token with the `workflow` scope if you push via a PAT; the GitHub UI and `GITHUB_TOKEN` in Actions do not have that restriction.

> ⚠️ Never commit a token to the repo or put it in frontend code — anything shipped to the browser is public. The in-app 🔑 field stores it in your browser only; the workflow reads it from the Actions secret.

### Local development token (optional)

Create a `.env` file (gitignored) to avoid pasting the token in the UI while developing:

```bash
VITE_GITHUB_TOKEN=github_pat_...
```

## Roadmap

- [x] GitHub token support for higher sync limits
- [x] Automated stats refresh via GitHub Actions
- [x] Star-history sparklines per tool
- [x] Category comparison mode
- [x] Community-submitted entries via PR template
- [x] Export filtered views to CSV/JSON
- [x] Command palette (`Cmd/Ctrl+K`)
- [x] Per-tool GitHub avatars
- [x] CI (lint + audit + build) on every push/PR

## Contributing

The dataset lives in [`src/data/tools.ts`](src/data/tools.ts) — one typed object per tool. To add or update an entry, open a PR using [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) (or file an issue with [`.github/ISSUE_TEMPLATE/add-tool.yml`](.github/ISSUE_TEMPLATE/add-tool.yml)). Required fields: `id`, `name`, `org`, `cat`, `tagline`, `desc`, `license`, `lang`, `stars`, `tags`, `status`, `year`. Include `repo` as `owner/name` whenever a public GitHub repository exists so live sync and the weekly snapshot can track it.

## License

[MIT](LICENSE) © 2026 Andrew Shannon (techaboo)
