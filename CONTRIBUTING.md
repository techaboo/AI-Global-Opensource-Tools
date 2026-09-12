# Contributing

Thank you for helping improve the Open Source AI Atlas. Contributions should make the catalog more accurate, transparent, usable, or accessible.

By participating, follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before opening a change

- Search existing catalog entries, issues, and pull requests.
- For a new tool or data correction, read [the methodology](docs/METHODOLOGY.md) and [data schema](docs/DATA_SCHEMA.md).
- For a vulnerability, use [the security policy](SECURITY.md), not a public issue.
- Keep each pull request focused. Large taxonomy or methodology changes should begin with an issue.

## Evidence standards

Prefer first-party, durable sources: the official source repository, project documentation, release notes, license file, organization site, or archived announcement. Link sources in the pull request.

Do not infer a license from package metadata alone when an authoritative repository license is available. Do not describe a project as secure, popular, maintained, open source, or production-ready without support. Catalog inclusion is not endorsement.

“Hot” is editorial and not computed. A change to `hot` must include a short rationale and recent evidence. Likewise, changes to `maintenance` or `archived` should cite evidence and follow the definitions in the methodology.

## Development workflow

```bash
npm install
npm run dev
```

Catalog records are curated in `src/data/tools.ts`. Keep changes focused and avoid unrelated metric churn.

Before requesting review:

```bash
npm run check-duplicates
npm run lint
npm run build
```

Do not hand-edit generated repository metrics just to update stars. `public/live-snapshot.json` is maintained by the scheduled/manual refresh process.

## Pull-request review

A reviewer checks:

- inclusion and evidence;
- duplicate IDs, names, and repositories;
- schema and category consistency;
- neutral, concise wording;
- license and status accuracy;
- privacy, security, and accessibility impact;
- successful data, lint, and build checks.

At least one maintainer approval is expected before merge. The repository owner has final merge authority. Review timing depends on volunteer capacity; there is no guaranteed response time. Substantive reviewer changes should be resolved in the pull-request record rather than off-platform.

## Update cadence

The public-repository baseline is scheduled weekly. Catalog text and editorial fields change through reviewed pull requests. Maintainers target a quarterly sample audit, but contributors should report stale data whenever they find it rather than waiting for an audit.

## Commit and PR quality

Use a descriptive title, explain the user-visible effect, link related issues, and disclose generated or AI-assisted content that has not been independently verified. Never include secrets or personal data.

## Legal note

This repository currently has no license file. Submission of a contribution does not by itself resolve that absence. Contributors must have the right to submit their work; the repository owner should establish explicit contribution and project licensing terms before broad reuse is expected.
