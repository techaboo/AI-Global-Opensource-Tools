# Open Source AI Atlas: rules for every session

Static React + TypeScript site (Vite) listing open-source AI tools, published to
GitHub Pages. Data: `src/data/catalog.json`. Automation: `scripts/` and
`.github/workflows/`.

## Read first

1. [docs/LEARNINGS.md](docs/LEARNINGS.md): mistakes already made here. Add to it.
2. [HOWTO.md](HOWTO.md#the-daily-pipeline): how the pipeline works.
3. [docs/METHODOLOGY.md](docs/METHODOLOGY.md) and [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md): before touching catalog data.

## Facts only

- Verify before stating. Check live state (`git fetch`, `gh`, the live site)
  instead of relying on memory, summaries or an earlier session.
- Say what was run and what it printed. If something was not verified, say so.
- Never invent catalog data, metrics, charts or counts. Descriptions of new
  entries come from the repository's own metadata.
- No unverifiable superlatives or hard-coded star counts in descriptions.
- Do not write tool totals into prose; derive them from the catalog.

## Start of work

```bash
git fetch origin --prune        # bots merge into main daily
node scripts/live-data.mjs pull # current stats, reject memory, last verification
npm ci
gh run list --limit 10          # is the pipeline healthy?
gh issue list --state open      # alerts from failed runs
```

Branch from `origin/main`. Never commit to `main` directly.

## Before saying it works

```bash
npm run validate     # lint, catalog validation, unit tests, build
npm run test:e2e     # browser and accessibility checks, desktop and mobile
GITHUB_TOKEN=<token> npm run verify:catalog   # after catalog or pipeline changes
```

After merging, confirm the Pages deploy succeeded and
`<site>/api/v1/meta.json` shows the expected `toolCount`.

## Invariants

- One entry per GitHub repository, by GitHub's current name, not the stored string.
- Automation changes the catalog only on hard facts or the documented gates.
  Judgment calls are reported, never auto-applied.
- The daily minimum never justifies lowering a quality check.
- Machine state lives on the `live-data` branch, never on `main`.
- A failed or missing GitHub lookup is not evidence about a project.
- Actions are pinned to commit SHAs; no `${{ inputs.* }}` inside `run:`.
- `.github/workflows/*` changes need `scripts/workflows.test.mjs` to pass.

## Layout

| Path | Role |
| --- | --- |
| `scripts/github.mjs` | batched GraphQL lookups |
| `scripts/fetch-stars.mjs`, `reconcile-lib.mjs` | refresh, renames, merges, archive status |
| `scripts/prune-*.mjs` | stale removal |
| `scripts/discover-*.mjs` | discovery |
| `scripts/verify-*.mjs` | live verification gate |
| `scripts/open-bot-pr.sh`, `alert-issue.sh` | publish and alert |
| `src/data/excluded.json` | repos a human rejected permanently |
