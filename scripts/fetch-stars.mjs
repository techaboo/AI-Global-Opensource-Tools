/**
 * Refreshes public/live-snapshot.json from the structurally loaded catalog.
 * The default local invocation is a read-only preflight; writing and network
 * access require --update or the repository's dedicated GitHub Actions job.
 *
 * Also corrects src/data/tools.ts's curated `status` to 'archived' when
 * GitHub itself says so — either the repo's own `archived: true` flag, or an
 * HTTP 404 (repo deleted/renamed with no redirect). Deliberately limited to
 * these two hard, unambiguous facts: this script never removes a catalog
 * entry or changes anything based on a judgment call (duplicates, category,
 * license plausibility) — those stay human-reviewed via the TypeSafe audit's
 * tracking issue (scripts/audit-catalog.mjs), since a false positive there
 * would silently delete real content rather than just mislabel a status.
 *
 * Usage: node scripts/fetch-stars.mjs
 *        GITHUB_TOKEN=<token> node scripts/fetch-stars.mjs --update
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import {
  CATALOG_PATH,
  SNAPSHOT_PATH,
  loadCatalog,
  readSnapshot,
  validateCatalog,
  validateSnapshot,
} from './catalog.mjs';

const TOKEN = process.env.GITHUB_TOKEN || process.env.KIMI_GITHUB_API || '';
const CONCURRENCY = 4;
const MAX_HISTORY = 52;
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log('Usage: node scripts/fetch-stars.mjs [--update]\n\nWithout --update, validates inputs and makes no requests or file changes.');
  process.exit(0);
}
if (args.some(arg => arg !== '--update') || args.filter(arg => arg === '--update').length > 1) {
  console.error(`Unknown or repeated argument(s): ${args.join(' ')}`);
  process.exit(2);
}
// The checked-in, purpose-specific refresh workflow is itself an explicit update operation.
const isRefreshWorkflow = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW === 'Refresh live GitHub stats';
const shouldUpdate = args.includes('--update') || isRefreshWorkflow;
const catalog = await loadCatalog();
const catalogResult = validateCatalog(catalog);
const previous = readSnapshot();
const snapshotResult = validateSnapshot(previous, catalog);
const inputErrors = [...catalogResult.errors, ...snapshotResult.errors];
if (inputErrors.length) {
  for (const error of inputErrors) console.error(`✗ ${error}`);
  console.error('Refusing to continue with invalid catalog or snapshot input.');
  process.exit(1);
}

const tools = catalog.tools.filter(tool => tool.repo).map(({ id, repo }) => ({ id, repo }));
console.log(`Validated ${catalog.tools.length} catalog records; ${tools.length} GitHub repos are eligible for refresh.`);
if (!shouldUpdate) {
  console.log('Read-only preflight complete. Re-run with --update to fetch stats and replace the snapshot.');
  process.exit(0);
}

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osi-atlas-refresh' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
else console.warn('No token set — GitHub limits unauthenticated requests.');

function sameUtcDay(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function appendHistory(history, stars, at) {
  const points = Array.isArray(history)
    ? history.filter(point => point && Number.isSafeInteger(point.t) && Number.isSafeInteger(point.s))
    : [];
  const last = points.at(-1);
  if (last && sameUtcDay(last.t, at)) points[points.length - 1] = { t: at, s: stars };
  else points.push({ t: at, s: stars });
  return points.slice(-MAX_HISTORY);
}

function githubApiUrl(repo) {
  return `https://api.github.com/repos/${repo.split('/').map(encodeURIComponent).join('/')}`;
}

const updated = {};
const toArchive = []; // { id, reason } — hard-fact signals only (GitHub archived flag, or confirmed 404)
let index = 0;
let done = 0;
let failed = 0;
let stopped = false;

async function worker() {
  while (index < tools.length && !stopped) {
    const tool = tools[index++];
    try {
      const response = await fetch(githubApiUrl(tool.repo), { headers });
      if ((response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') || response.status === 429) {
        console.error(`GitHub request limit reached at ${done}/${tools.length}; retaining previous data for unfinished repos.`);
        stopped = true;
        failed++;
        return;
      }
      if (response.status === 404) {
        toArchive.push({ id: tool.id, reason: `${tool.repo} returned 404 (deleted or renamed with no redirect)` });
        throw new Error('repository not found (404)');
      }
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const data = await response.json();
      for (const field of ['stargazers_count', 'forks_count', 'open_issues_count']) {
        if (!Number.isSafeInteger(data[field]) || data[field] < 0) throw new Error(`GitHub response has invalid ${field}`);
      }
      if (typeof data.pushed_at !== 'string' || !Number.isFinite(Date.parse(data.pushed_at))) throw new Error('GitHub response has invalid pushed_at');
      if (data.archived === true) toArchive.push({ id: tool.id, reason: `${tool.repo} is archived on GitHub` });

      const fetchedAt = Date.now();
      updated[tool.id] = {
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        pushedAt: data.pushed_at,
        fetchedAt,
        history: appendHistory(previous.repos[tool.id]?.history, data.stargazers_count, fetchedAt),
      };
    } catch (error) {
      failed++;
      console.error(`  ✗ ${tool.repo}: ${error.message}`);
    } finally {
      done++;
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tools.length) }, worker));
if (Object.keys(updated).length === 0) {
  console.error('No repositories were refreshed; snapshot was not changed.');
  process.exit(1);
}

const toolById = new Map(catalog.tools.map(tool => [tool.id, tool]));
const archivedNow = toArchive.filter(({ id }) => toolById.get(id)?.status !== 'archived');
if (archivedNow.length) {
  let source = readFileSync(CATALOG_PATH, 'utf8');
  for (const { id, reason } of archivedNow) {
    const lineRe = new RegExp(`^(\\s*\\{ id: '${id}',.*?)status: '(?:active|maintenance|archived)'(.*\\},?\\s*)$`, 'm');
    const next = source.replace(lineRe, `$1status: 'archived'$2`);
    if (next === source) {
      console.error(`  ✗ Could not locate the status field for ${id} in tools.ts — left unchanged (${reason}).`);
      continue;
    }
    source = next;
    console.log(`  ! Marked ${id} archived — ${reason}`);
  }
  writeFileSync(CATALOG_PATH, source);
}

// Keep failed/current records, while pruning entries no longer represented by a catalog repo.
const repos = Object.fromEntries(tools.flatMap(tool => {
  const entry = updated[tool.id] ?? previous.repos[tool.id];
  return entry ? [[tool.id, entry]] : [];
}));
const snapshot = { generatedAt: new Date().toISOString(), repos };
const outputResult = validateSnapshot(snapshot, catalog);
if (outputResult.errors.length) {
  for (const error of outputResult.errors) console.error(`✗ ${error}`);
  console.error('Generated snapshot failed validation; existing file was not changed.');
  process.exit(1);
}

const temporaryPath = `${SNAPSHOT_PATH}.tmp-${process.pid}`;
writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
renameSync(temporaryPath, SNAPSHOT_PATH);
console.log(`Wrote ${Object.keys(updated).length} updated / ${Object.keys(repos).length} total repo stats (${failed} failed) → public/live-snapshot.json`);
if (failed) process.exitCode = 1;
