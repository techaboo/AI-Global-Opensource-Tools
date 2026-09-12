# Catalog Methodology

## Purpose and limits

The Open Source AI Atlas is a curated discovery catalog. It is not a benchmark, security review, legal opinion, procurement recommendation, or endorsement. Inclusion indicates that available evidence met the criteria at review time.

The application calculates current tool and category totals from its catalog data. Documentation should use non-brittle language such as “hundreds of tools across dozens of categories” unless a count is generated directly from the same source.

## Inclusion criteria

An entry should normally have all of the following:

1. A publicly accessible source repository containing a meaningful implementation, not only a landing page or client stub.
2. AI/ML as a material purpose or enabling capability, rather than incidental marketing language.
3. Enough first-party information to verify identity, purpose, repository ownership or provenance, and license.
4. A distinct use case, implementation, ecosystem role, or community that makes the entry useful for discovery.
5. A stable official URL or repository coordinate.

Projects may be early-stage, specialized, research-oriented, or archived if their status is represented accurately. A hosted commercial service does not disqualify an entry when the cataloged project itself has meaningful open-source code.

## Reasons to decline or remove

Examples include:

- no verifiable source implementation or license;
- duplicate, fork-only, renamed, or moved entries better represented by an existing record;
- AI relevance limited to unsupported claims;
- repository content that is primarily spam, malware, credential theft, or unlawful material;
- materially false metadata that cannot be corrected;
- an entry too incomplete to identify or assess.

Removal is not a statement about a project's worth. When practical, record the evidence and reason in an issue or pull request. Moved or renamed projects should usually be corrected rather than deleted.

## Source hierarchy

Use, in order of preference:

1. official repository files and settings;
2. official documentation and release notes;
3. the project's organization or maintainer site;
4. reputable package registries or independent sources as corroboration.

Descriptions should be concise, neutral summaries. Avoid unqualified superlatives and claims of safety, popularity, production readiness, or compliance.

## Category selection

Assign the category representing the project's primary user-facing purpose. Secondary capabilities belong in tags rather than duplicate entries. Taxonomy changes should consider migration effects and begin with an issue when they affect many records.

## Status definitions

Status is a catalog availability/maintenance signal, not a quality or security grade:

- **`active`** — the default editorial baseline, or a repository that a successful GitHub refresh reports as not archived. It does not prove frequent releases or responsive maintenance.
- **`maintenance`** — an editorial judgment that the project appears usable but is in limited, stability-only, or reduced development. Cite first-party evidence or a sustained activity pattern.
- **`archived`** — the source repository is marked archived by GitHub, or authoritative project evidence says development has ended. A successful live or scheduled GitHub refresh can set this automatically from the repository's archived flag.

A failed, missing, rate-limited, or stale refresh must not by itself be interpreted as abandonment. Repository moves and temporary outages should be investigated.

## “Hot” label

`hot` is **editorial; it is not computed**. It is a qualitative discovery badge, not a ranking or award. Reviewers may consider recent releases, contributor momentum, adoption, distinctive impact, and sustained community interest, but no fixed threshold currently exists. Proposals must provide dated evidence, disclose conflicts of interest, and avoid relying on stars alone.

Because the label can become stale, maintainers should sample it during quarterly editorial audits and remove it when evidence no longer supports heightened attention.

## Stars and repository activity

Catalog metrics have different freshness levels:

1. Curated records contain an initial star value.
2. `public/live-snapshot.json` supplies a scheduled baseline generated every Monday at 05:17 UTC, plus manual workflow runs.
3. The browser can perform a user-triggered refresh against GitHub for a filtered batch or individual tool. A token is optional; unauthenticated requests are more limited.

Newer `fetchedAt` values take precedence when cached and scheduled data are merged. GitHub stars, forks, open issues, and push times are volatile and can be absent or partial. They should not be treated as comparable quality scores.

## Review and corrections

Catalog additions and material changes require a pull request with authoritative sources. Review covers duplicates, inclusion, neutral wording, category, license, repository coordinates, status, editorial labels, and validation checks. Conflicted reviewers should not be the sole decision-maker.

The repository baseline refreshes weekly. Editorial corrections are reviewed continuously as capacity permits, with a target of sampling stale fields at least quarterly. There is no guaranteed review time. Anyone may submit a correction with evidence.
