# Privacy Notice

This notice describes behavior visible in the current source code. A deployment operator may add hosting logs, analytics, headers, or other processing; consult that deployment's operator as well.

## Data in the browser

| Data | Storage | Retention |
| --- | --- | --- |
| Favorite tool IDs | `localStorage` | Until changed or site data is cleared |
| Theme preference | `localStorage` | Until changed or site data is cleared |
| Cached public GitHub metrics and star history | `localStorage` | Updated during use; remains until site data is cleared |
| Optional GitHub token | `localStorage` | Until removed with the key control or site data is cleared |
| Filters, searches, view, and comparisons | URL query string | In browser history and any copied/shared URL |

The repository does not include application analytics or an account system. Browser storage stays on the device unless the browser, an extension, device backup, or synchronization feature copies it.

## GitHub requests

The site loads a public baseline snapshot from its own deployed files. When a user selects **Sync GitHub**, or opens a tool whose details are refreshed, the browser requests public repository metadata from `https://api.github.com/repos/...`. GitHub receives the usual network request information, such as IP address and browser headers, under GitHub's own privacy terms.

If supplied, the token is attached as a bearer credential to those GitHub API requests. It is not included in catalog exports or `public/live-snapshot.json`. Because it is stored in `localStorage`, it persists across browser sessions and can be read by scripts running under the same site origin. Use a fine-grained, least-privilege token with no unnecessary access; do not use a sensitive token on a shared device.

The local-development `VITE_GITHUB_TOKEN` path is enabled only in development mode. Production deployments should not put secrets in client-side Vite variables. The scheduled workflow uses its environment-provided `GITHUB_TOKEN` to fetch public metadata; the generated file contains metrics, not that credential.

## Exports and links

CSV/JSON exports contain the currently filtered public catalog and metrics, not favorites or the GitHub token. Search terms and selected filters may appear in the page URL. Review exported files and URLs before sharing them.

## Clear stored data

- Remove the token with the key control in the application.
- Remove favorites through the application, or clear this site's browser data.
- Clear cached metrics, history, theme, and all other stored values by clearing this site's browser storage.
- Remove shared filter/search state by clearing the URL query string and, if desired, browser history.

## Privacy reports

Open an issue for a general privacy-documentation correction. If a report contains a token, personal information, or an exploitable weakness, follow [SECURITY.md](SECURITY.md) and report it privately.
