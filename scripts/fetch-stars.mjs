/**
 * Refreshes public/live-snapshot.json with live GitHub repo stats.
 * Run by .github/workflows/refresh-stars.yml (uses the KIMI_GITHUB_API repo secret),
 * or locally:  GITHUB_TOKEN=<token> node scripts/fetch-stars.mjs
 *
 * The token is read from the environment only — it is never written to disk.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.GITHUB_TOKEN || process.env.KIMI_GITHUB_API || '';
const CONCURRENCY = 4;

const src = readFileSync(join(root, 'src/data/tools.ts'), 'utf8');
// Parse line-by-line so each id is matched only with the repo on its own entry
const tools = [];
for (const line of src.split('\n')) {
  const id = line.match(/^\s*\{\s*id:\s*'([^']+)'/);
  const repo = line.match(/\brepo:\s*'([^']+)'/);
  if (id && repo) tools.push({ id: id[1], repo: repo[1] });
}
console.log(`Found ${tools.length} repos to refresh`);

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osi-atlas-refresh' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
else console.warn('No token set — limited to 60 requests/hour');

const out = {};
let idx = 0, done = 0, failed = 0;

async function worker() {
  while (idx < tools.length) {
    const t = tools[idx++];
    try {
      const res = await fetch(`https://api.github.com/repos/${t.repo}`, { headers });
      if (res.status === 403 || res.status === 429) {
        console.error(`Rate limited at ${done}/${tools.length} — stopping`);
        idx = tools.length;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      out[t.id] = {
        stars: j.stargazers_count ?? 0,
        forks: j.forks_count ?? 0,
        openIssues: j.open_issues_count ?? 0,
        pushedAt: j.pushed_at ?? '',
        fetchedAt: Date.now(),
      };
    } catch (e) {
      failed++;
      console.error(`  ✗ ${t.repo}: ${e.message}`);
    }
    done++;
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const snapshot = { generatedAt: new Date().toISOString(), repos: out };
writeFileSync(join(root, 'public/live-snapshot.json'), JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${Object.keys(out).length} repo stats (${failed} failed) → public/live-snapshot.json`);
