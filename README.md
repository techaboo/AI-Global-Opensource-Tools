# Open Source AI Atlas

**The living map of open-source AI** — a reactive dashboard that catalogs, filters, and dynamically tracks **234 open-source AI tools across 24 categories**, from foundation models to robotics.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06b6d4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

The open-source AI ecosystem moves fast — new models, agent frameworks, and inference engines ship weekly, and yesterday's leaders get archived. The AI Atlas is a single-pane-of-glass catalog built from hands-on ecosystem research, designed to stay current through **live GitHub data syncing**.

Every entry is enriched with: organization, license, primary language, release year, star count, tags, health status (active / maintenance / archived), and a researched description.

### Categories covered (24)

Foundation Models · Vision-Language Models · Inference & Serving · Chat & Frontends · Agent Frameworks · Coding Agents · Personal Assistants · Browser & Computer Use · RAG, Memory & Knowledge · Vector Databases · Workflow & Low-Code · Image Generation · Video Generation · Audio & Speech · Fine-tuning & Training · Frameworks & Libraries · MLOps & Gateways · Eval & Observability · Safety & Guardrails · Data & Labeling · Computer Vision · Document AI & OCR · MCP Ecosystem · Robotics & RL

## Features

- **Instant search** — full-text across names, orgs, descriptions, tags, and licenses (press `/` to focus)
- **Rich filtering** — by category, license, language, and project health status, with one-click reset
- **Three views** — card grid, sortable table, and a full analytics dashboard
- **Analytics** — tools-per-category (click-to-filter), top-12 by stars, license mix, project health, language breakdown, and release-year timeline (Recharts)
- **Live GitHub sync** — batch-refresh stars/forks/issues for the visible list via the GitHub REST API, with concurrency control, progress bar, rate-limit detection, and per-repo "fetch live" in the detail panel. Results are cached in `localStorage` and marked with a LIVE badge
- **Detail panels** — slide-out sheets with stats, metadata, tags, and direct repository links
- **Dark / light theme** — dark by default, one-click toggle
- **Fully responsive** — category sidebar on desktop, chip rail on mobile

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 7 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| Charts | Recharts |
| Icons | lucide-react |
| Live data | GitHub REST API (unauthenticated, ~60 req/hr) |

## Getting started

```bash
git clone https://github.com/techaboo/AI-Global-Opensource-Tools.git
cd AI-Global-Opensource-Tools
npm install
npm run dev
```

Then open http://localhost:5173.

### Build for production

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Project structure

```
src/
├── App.tsx                  # Dashboard shell: state, filtering, sorting, layout
├── main.tsx                 # Entry point
├── index.css                # Tailwind + theme tokens
├── data/
│   └── tools.ts             # The catalog: 234 tools, 24 categories (typed dataset)
├── types/index.ts           # AITool, Category, LiveRepoData types
├── hooks/
│   └── useGitHubSync.ts     # Live GitHub sync: concurrency, caching, rate limits
├── lib/
│   ├── format.ts            # Star formatting, time-ago, license colors
│   └── utils.ts             # cn() helper
└── components/
    ├── Header.tsx           # Search, sync button + progress, theme toggle
    ├── CategoryNav.tsx      # Category sidebar with counts
    ├── StatsBar.tsx         # Headline metrics
    ├── FilterBar.tsx        # Sort / license / language / status / view controls
    ├── ToolCard.tsx         # Grid cards
    ├── ToolTable.tsx        # Table view
    ├── ToolDetail.tsx       # Slide-out detail sheet + per-repo live fetch
    ├── Analytics.tsx        # Six-chart analytics view
    └── ui/                  # shadcn/ui primitives used by the app
```

## Data & freshness model

- The bundled star counts are a **labeled research snapshot** (August 2026) so the app works fully offline.
- **Sync GitHub** refreshes live figures for the currently filtered list (up to 60 repos per pass, matching the unauthenticated API rate limit). Live values override snapshots everywhere — cards, table, charts, and headline stats.
- Synced data is cached in the browser's `localStorage` only; it does not persist across devices.

## Roadmap

- [ ] GitHub token support for higher sync limits
- [ ] Star-history sparklines per tool
- [ ] Category comparison mode
- [ ] Community-submitted entries via PR template
- [ ] Export filtered views to CSV/JSON

## Contributing

The dataset lives in [`src/data/tools.ts`](src/data/tools.ts) — one typed object per tool. To add or update an entry, open a PR with the new/edited object (name, org, category, license, language, repo, tags, and a one-line tagline).

## License

[MIT](LICENSE) © 2026 Andrew Shannon (techaboo)
