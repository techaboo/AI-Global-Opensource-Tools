/**
 * Refreshes public/live-snapshot.json with live GitHub repo stats.
 * Run by .github/workflows/refresh-stars.yml (uses the KIMI_GITHUB_API repo secret),
 * or locally:  GITHUB_TOKEN=<token> node scripts/fetch-stars.mjs
 *              npm run fetch-stars
 *
 * The token is read from the environment only — it is never written to disk.
 *
 * Star history: each successful fetch appends a { t, s } sample (one per UTC day,
 * capped at 52). Previous snapshot samples are preserved so weekly CI builds a
 * real sparkline without hitting GitHub's expensive stargazer timeline API.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP_PATH = join(root, 'public/live-snapshot.json');
const TOKEN = process.env.GITHUB_TOKEN || process.env.KIMI_GITHUB_API || '';
const CONCURRENCY = 4;
const MAX_HISTORY = 52;

const src = readFileSync(join(root, 'src/data/tools.ts'), 'utf8');
// Parse line-by-line so each id is matched only with the repo on its own entry
const tools = [];
for (const line of src.split('\n')) {
  const id = line.match(/^\s*\{\s*id:\s*'([^']+)'/);
  const repo = line.match(/\brepo:\s*'([^']+)'/);
  if (id && repo) tools.push({ id: id[1], repo: repo[1] });
}
console.log(`Found ${tools.length} repos to refresh`);

let prev = { generatedAt: null, repos: {} };
try {
  prev = JSON.parse(readFileSync(SNAP_PATH, 'utf8'));
  if (!prev.repos || typeof prev.repos !== 'object') prev.repos = {};
} catch {
  prev = { generatedAt: null, repos: {} };
}

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osi-atlas-refresh' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
else console.warn('No token set — limited to 60 requests/hour');

function sameUtcDay(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function appendHistory(history, stars, at) {
  const pts = Array.isArray(history) ? history.filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.s)) : [];
  const last = pts[pts.length - 1];
  if (last && sameUtcDay(last.t, at)) pts[pts.length - 1] = { t: at, s: stars };
  else pts.push({ t: at, s: stars });
  return pts.slice(-MAX_HISTORY);
}

const out = {};
let idx = 0, done = 0, failed = 0, stopped = false;

async function worker() {
  while (idx < tools.length && !stopped) {
    const t = tools[idx++];
    try {
      const res = await fetch(`https://api.github.com/repos/${t.repo}`, { headers });
      if (res.status === 403 || res.status === 429) {
        console.error(`Rate limited at ${done}/${tools.length} — stopping (previous snapshot kept for remaining repos)`);
        stopped = true;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const stars = j.stargazers_count ?? 0;
      const fetchedAt = Date.now();
      const prevEntry = prev.repos[t.id] ?? {};
      out[t.id] = {
        stars,
        forks: j.forks_count ?? 0,
        openIssues: j.open_issues_count ?? 0,
        pushedAt: j.pushed_at ?? '',
        fetchedAt,
        history: appendHistory(prevEntry.history, stars, fetchedAt),
      };
    } catch (e) {
      failed++;
      console.error(`  ✗ ${t.repo}: ${e.message}`);
    }
    done++;
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Merge: newly fetched repos overwrite; everything else (including history) is kept
// so a mid-run rate limit does not wipe last week's snapshot.
const repos = { ...prev.repos, ...out };
const snapshot = { generatedAt: new Date().toISOString(), repos };
writeFileSync(SNAP_PATH, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${Object.keys(out).length} updated / ${Object.keys(repos).length} total repo stats (${failed} failed) → public/live-snapshot.json`);
