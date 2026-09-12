# Roadmap

This roadmap communicates priorities, not promises. Timing depends on maintainer capacity, and accepted issues or pull requests may change the order.

## Now: trust and maintainability

- Keep catalog descriptions, links, licenses, categories, and repository coordinates verifiable.
- Document inclusion, status, “Hot,” data freshness, privacy, security, governance, and accessibility practices.
- Reduce count drift by deriving displayed totals from catalog data instead of repeating static totals in prose.
- Maintain duplicate/schema checks and a reproducible production build.

## Next: data quality

- Add stronger automated schema validation for IDs, categories, repository coordinates, URLs, licenses, years, and status values.
- Make freshness and source timestamps clearer in the interface and exports.
- Establish repeatable reports for broken links, moved repositories, archived projects, and stale editorial fields.
- Improve provenance so material claims can be traced to authoritative sources.
- Review the purpose and consistency of editorial “Hot” labels.

## Later: community and usability

- Improve keyboard, screen-reader, focus, contrast, reduced-motion, and small-screen testing.
- Explore a documented review queue and clearer catalog correction history.
- Evaluate localization and machine-readable catalog publication without weakening review controls.
- Consider privacy-preserving ways to make refresh failures and rate limits easier to understand.

## How priorities are chosen

The owner weighs user impact, correctness, trust and safety, accessibility, maintenance cost, contributor readiness, and compatibility. Major methodology or governance changes should begin in an issue and follow [GOVERNANCE.md](GOVERNANCE.md).

To propose an item, open a focused issue describing the problem, affected users, evidence, possible approach, and trade-offs.
