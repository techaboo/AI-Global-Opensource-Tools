# Data Schema

The canonical catalog is the TypeScript data exported from `src/data/tools.ts`; interfaces are defined in `src/types/index.ts`. This document describes the current contract but does not replace compiler and validation checks.

## `AITool`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable, unique, URL-safe identifier |
| `name` | string | Project's preferred public name |
| `organization` | string | Responsible organization or maintainer label supported by a source |
| `category` | `CategoryId` | One defined primary category ID |
| `tagline` | string | Short neutral summary |
| `description` | string | Factual overview of purpose and differentiators |
| `url` | URL string | Official project or documentation URL |
| `repo` | `{ owner, name }` | GitHub repository coordinate used for refreshes |
| `license` | string | SPDX-style identifier or accurate project-provided label |
| `language` | string | Primary implementation language as cataloged |
| `stars` | number | Curated fallback/initial value; not guaranteed current |
| `year` | number | Project origin/public-release year when verifiable |
| `hot` | boolean | Manual editorial discovery label; never imply it is computed |
| `status` | `active \| maintenance \| archived` | Limited status signal defined in the methodology |
| `tags` | string[] | Search and secondary-capability terms |

IDs should not be recycled after renames. Correct repository coordinates rather than creating a duplicate record for a move. Text must not contain secrets or unnecessary personal data.

## `Category`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `CategoryId` | Stable category key referenced by tools and URLs |
| `label` | string | Display name |
| `icon` | string | Display icon name |
| `gradient` | string | Presentation gradient |
| `description` | string | Scope of the category |

Category totals and tool totals are derived from these arrays at runtime. Do not copy a numeric total into documentation unless it is generated from this source.

## Public read-only API

`scripts/generate-api.mjs` runs on every `npm run build` and writes the validated
catalog as plain JSON into `public/api/v1/`, which `vite build` then copies into
`dist/` alongside the site — so it's served from wherever the site itself is
hosted, with no separate backend:

| Path | Contents |
| --- | --- |
| `/api/v1/tools.json` | The full `AITool[]` array, same shape as this document's `AITool` table |
| `/api/v1/categories.json` | The full `Category[]` array |
| `/api/v1/meta.json` | `{ generatedAt, schemaVersion, toolCount, categoryCount, snapshotDate }` |

This is a free, unauthenticated, static mirror of the catalog — there is no
rate limiting or access control, because there is no server to enforce it. It
updates only when the site is rebuilt and redeployed, not live. A metered or
paid tier would need an actual backend (e.g. a small Worker in front of the
same data) rather than a static file.

## Scheduled snapshot

`public/live-snapshot.json` is generated, not an editorial source file. Its top-level shape is:

```json
{
  "generatedAt": "ISO-8601 timestamp",
  "repos": {
    "owner/name": {
      "stars": 0,
      "forks": 0,
      "openIssues": 0,
      "pushedAt": "ISO-8601 timestamp or null",
      "archived": false,
      "fetchedAt": "ISO-8601 timestamp"
    }
  }
}
```

A repository may be absent when coordinates are missing, a request fails, or GitHub limits access. Consumers must tolerate absent/invalid snapshots and missing repository entries. The generated file contains public metadata, not the workflow token.

## Browser live data

The in-memory `LiveRepoData` shape includes:

| Field | Type | Meaning |
| --- | --- | --- |
| `stars` | number | Current observed stargazer count |
| `forks` | number | Current observed fork count |
| `openIssues` | number | GitHub open-issues count as returned by the API |
| `pushedAt` | ISO timestamp or `null` | Repository `pushed_at` value |
| `fetchedAt` | ISO timestamp | Observation time |
| `history` | array of `{ date, stars }` | Locally accumulated daily star observations |

The UI merges curated tools with live data. A successful refresh sets status to `archived` when GitHub's archived flag is true and otherwise to `active`. This means live data can supersede an editorial status for a fetched repository; reviewers should consider that limitation when assigning `maintenance`.

## Validation expectations

Run:

```bash
npm run check-duplicates
npm run lint
npm run build
```

Review should also verify unique IDs and repositories, defined categories, valid URLs, authoritative licenses, realistic years, non-negative numeric values, neutral descriptions, and evidence for editorial fields.
