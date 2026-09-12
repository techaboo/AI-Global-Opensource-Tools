# Security Policy

## Supported version

Security fixes are considered for the current default branch and the currently deployed site. Historical commits, forks, and third-party deployments are not maintained by this project.

## Report a vulnerability

Please do not open a public issue for an unpatched vulnerability or include tokens, personal data, exploit details, or other secrets in an issue or pull request.

Use GitHub's **Private vulnerability reporting** / Security Advisory feature for this repository if it is available. If it is not available, contact the repository owner privately through the contact options on their GitHub profile and include:

- the affected page, component, or commit;
- impact and realistic attack scenario;
- reproduction steps or a minimal proof of concept;
- suggested remediation, if known;
- whether the report may be credited publicly.

The owner will aim to acknowledge a report within 7 days and provide an initial assessment within 14 days. These are targets, not guaranteed service levels. Disclosure timing will be coordinated around a fix when practical.

## Scope notes

Catalog entries link to independent third-party projects. Their vulnerabilities must be reported to those projects unless the Atlas itself introduces the issue. An inaccurate catalog claim can use the data-correction process rather than security reporting unless publishing it creates an immediate security risk.

## Token and deployment safety

- The optional in-app GitHub token is currently stored in browser `localStorage`, persists until removed or site data is cleared, and is sent by the app to `api.github.com` for repository requests. Use a narrowly restricted token and avoid shared devices.
- Any script running in the same site origin, including code introduced through a cross-site scripting flaw, could potentially read browser storage. Treat XSS reports as sensitive.
- `VITE_GITHUB_TOKEN` is intended only for local development and is gated to development mode. Do not place secrets in client-side production environment variables.
- The scheduled refresh uses the workflow-provided `GITHUB_TOKEN`; generated snapshots contain public repository data, not the token.
- Never commit `.env`, credentials, private repository data, or raw security reports.

## Dependency reports

Include the dependency name, affected version range, advisory identifier, and reachable impact in this application. An advisory alone does not establish exploitability, but it is still useful evidence.
