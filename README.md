# Open Source AI Atlas

A browsable catalog of open-source AI tools, projects, libraries, and infrastructure, organized across dozens of categories.

**Live site:** https://techaboo.github.io/AI-Global-Opensource-Tools/

The application derives catalog and category totals from its data at runtime. This README intentionally avoids a manually maintained numeric total, which can drift as entries change.

## What the Atlas provides

- Search and filters for category, language, license, and catalog status
- Grid, table, analytics, and comparison views
- Favorites stored in the browser
- Baseline repository metrics refreshed on a schedule
- A user-triggered GitHub refresh for newer public-repository metrics
- CSV and JSON export of the current filtered view

## Data freshness

The Atlas combines three layers:

1. **Curated catalog data** in `src/data/tools.ts` supplies identity, descriptions, categories, tags, licenses, languages, baseline metrics, and editorial fields.
2. **Scheduled baseline data** in `public/live-snapshot.json` is refreshed by GitHub Actions every Monday at 05:17 UTC and can also be refreshed manually by a workflow maintainer. The site loads this snapshot when available.
3. **Optional live refresh** is initiated with **Sync GitHub** (or for an individual tool when its details are opened). The browser requests public repository metadata directly from `api.github.com`, for up to 60 filtered tools per bulk sync.

A token is not required, but unauthenticated GitHub requests have a much lower rate limit. See [PRIVACY.md](PRIVACY.md) before adding one. Metrics are point-in-time observations and may be partial when repositories are unavailable or GitHub limits requests.

## Catalog methodology

Catalog inclusion is editorial, not an endorsement or certification. “Hot” is a manually assigned discovery label; it is not computed from stars or activity. Status has defined but limited semantics and should not be read as a security or quality rating.

See:

- [Methodology](docs/METHODOLOGY.md)
- [Data schema](docs/DATA_SCHEMA.md)
- [Privacy](PRIVACY.md)
- [Accessibility](docs/ACCESSIBILITY.md)

## Run locally

Requirements: a current Node.js LTS release and npm.

```bash
git clone https://github.com/techaboo/AI-Global-Opensource-Tools.git
cd AI-Global-Opensource-Tools
npm install
npm run dev
```

Useful checks:

```bash
npm run check-duplicates
npm run lint
npm run build
```

For optional development-only GitHub access, copy `.env.example` to `.env` and set `VITE_GITHUB_TOKEN`. The current code reads this variable only during development. Never commit `.env` or a token.

## Contributing

Corrections, additions, accessibility reports, and methodology improvements are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and use the issue or pull-request templates. A catalog submission should include verifiable first-party sources and explain how it meets the inclusion criteria.

## Project policies

- [How to use and maintain the Atlas](HOWTO.md)
- [Security policy](SECURITY.md)
- [Privacy notice](PRIVACY.md)
- [Governance](GOVERNANCE.md)
- [Maintainers](MAINTAINERS.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Roadmap](ROADMAP.md)

## License

The Atlas application and repository materials are available under the [MIT License](LICENSE). Individual cataloged projects retain their own licenses; verify each license at its authoritative source before adopting a project.
