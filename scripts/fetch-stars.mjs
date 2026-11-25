/**
 * Refreshes public/live-snapshot.json from the structurally loaded catalog.
 * The default local invocation is a read-only preflight; writing and network
 * access require --update or the repository's dedicated GitHub Actions job.
 *
 * Also corrects src/data/catalog.json's curated `status` to 'archived' when
 * GitHub itself says so — either the repo's own `archived: true` flag, or an
 * HTTP 404 (repo deleted/renamed with no redirect) that has persisted for
 * MISSING_GRACE_DAYS (first-404 times live in the snapshot's `missing` map).
 * Deliberately limited to
 * these two hard, unambiguous facts, and reversed when GitHub shows the repo
 * unarchived with a recent push. It also follows GitHub renames and merges
 * entries that resolve to the same repository (scripts/reconcile-lib.mjs). Stale
 * entries are removed daily by scripts/prune-stale.mjs. Nothing changes on a
 * judgment call (duplicates, category,
 * license plausibility) — those stay human-reviewed via the TypeSafe audit's
 * tracking issue (scripts/audit-catalog.mjs), since a false positive there
 * would silently delete real content rather than just mislabel a status.
 *
 * Usage: node scripts/fetch-stars.mjs
 *        GITHUB_TOKEN=<token> node scripts/fetch-stars.mjs --update
 */
import { renameSync, writeFileSync } from 'node:fs';
import { appendStarPoint } from '../src/lib/historyCore.js';
import {
  SNAPSHOT_PATH,
  loadCatalog,
  loadExcluded,
  readSnapshot,
  validateCatalog,
  validateSnapshot,
  writeCatalog,
} from './catalog.mjs';
import { fetchRepoFacts } from './github.mjs';
import { MISSING_GRACE_DAYS, isRevived, trackMissing } from './prune-lib.mjs';
import { MAX_REMOVALS, reconcileRepos } from './reconcile-lib.mjs';

const TOKEN = process.env.GITHUB_TOKEN || '';
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

let tools = catalog.tools.filter(tool => tool.repo).map(({ id, repo }) => ({ id, repo }));
console.log(`Validated ${catalog.tools.length} catalog records; ${tools.length} GitHub repos are eligible for refresh.`);
if (!shouldUpdate) {
  console.log('Read-only preflight complete. Re-run with --update to fetch stats and replace the snapshot.');
  process.exit(0);
}

const facts = await fetchRepoFacts(tools.map(tool => tool.repo), { token: TOKEN });

// Follow renames and merge entries that turn out to be one repository.
const reconciled = reconcileRepos(catalog.tools, facts, loadExcluded());
if (reconciled.removed.length > MAX_REMOVALS) {
  console.error(`Refusing to remove ${reconciled.removed.length} entries in one run (limit ${MAX_REMOVALS}); no files changed.`);
  process.exit(1);
}
for (const { id, from, to } of reconciled.renamed) console.log(`  ! ${id}: repository renamed ${from} -> ${to}`);
for (const { id, repo, reason, keptId } of reconciled.removed) {
  console.log(`  ! Removed ${id} (${repo}): ${reason}`);
  // Same repository, so the longer star history belongs to the kept entry too.
  const old = previous.repos[id];
  if (keptId && old && old.history.length > (previous.repos[keptId]?.history.length ?? 0)) previous.repos[keptId] = old;
}
const factById = new Map(tools.map(tool => [tool.id, facts.get(tool.repo)]));
catalog.tools = reconciled.tools;
tools = catalog.tools.filter(tool => tool.repo).map(({ id, repo }) => ({ id, repo }));

const updated = {};
const toArchive = []; // { id, reason } — hard-fact signals only (GitHub archived flag, or confirmed 404)
const missingIds = []; // ids whose repo GitHub reports as not found this run
const revived = []; // ids GitHub shows unarchived and recently pushed
let failed = 0;

for (const tool of tools) {
  const fact = factById.get(tool.id);
  if (fact.status === 'missing') {
    // Recorded here and archived below only once it has persisted. It is not a
    // refresh failure: failing the run would block publishing the snapshot that
    // remembers when the 404 started.
    missingIds.push(tool.id);
    console.error(`  ! ${tool.repo}: repository not found (404); keeping previous data`);
    continue;
  }
  if (fact.status !== 'ok') {
    failed++;
    console.error(`  ✗ ${tool.repo}: ${fact.message}`);
    continue;
  }
  if (fact.archived) toArchive.push({ id: tool.id, reason: `${tool.repo} is archived on GitHub` });
  if (isRevived({ archived: fact.archived, pushed_at: fact.pushedAt })) revived.push(tool.id);

  const fetchedAt = Date.now();
  updated[tool.id] = {
    stars: fact.stars,
    forks: fact.forks,
    openIssues: fact.openIssues,
    pushedAt: fact.pushedAt,
    fetchedAt,
    history: appendStarPoint(previous.repos[tool.id]?.history, fact.stars, fetchedAt),
  };
}

if (Object.keys(updated).length === 0) {
  console.error('No repositories were refreshed; snapshot was not changed.');
  process.exit(1);
}

const toolById = new Map(catalog.tools.map(tool => [tool.id, tool]));
const { missing, confirmed } = trackMissing(previous.missing, {
  missingIds, foundIds: Object.keys(updated), knownIds: tools.map(tool => tool.id),
});
for (const id of confirmed) {
  toArchive.push({ id, reason: `${toolById.get(id).repo} has returned 404 for ${MISSING_GRACE_DAYS}+ days` });
}
const archivedNow = toArchive.filter(({ id }) => toolById.get(id)?.status !== 'archived');
const unarchivedNow = revived.filter(id => toolById.get(id)?.status === 'archived');
if (archivedNow.length || unarchivedNow.length || reconciled.renamed.length || reconciled.removed.length) {
  // Structured edit of the parsed catalog — no regexes over source text.
  for (const { id, reason } of archivedNow) {
    toolById.get(id).status = 'archived';
    console.log(`  ! Marked ${id} archived — ${reason}`);
  }
  for (const id of unarchivedNow) {
    toolById.get(id).status = 'active';
    console.log(`  ! Marked ${id} active — GitHub shows it unarchived with a recent push`);
  }
  writeCatalog(catalog);
}

// Keep failed/current records, while pruning entries no longer represented by a catalog repo.
const repos = Object.fromEntries(tools.flatMap(tool => {
  const entry = updated[tool.id] ?? previous.repos[tool.id];
  return entry ? [[tool.id, entry]] : [];
}));
const snapshot = { generatedAt: new Date().toISOString(), repos, missing };
const outputResult = validateSnapshot(snapshot, catalog);
if (outputResult.errors.length) {
  for (const error of outputResult.errors) console.error(`✗ ${error}`);
  console.error('Generated snapshot failed validation; existing file was not changed.');
  process.exit(1);
}

const temporaryPath = `${SNAPSHOT_PATH}.tmp-${process.pid}`;
// Compact: every visitor downloads this file.
writeFileSync(temporaryPath, `${JSON.stringify(snapshot)}\n`, { encoding: 'utf8', mode: 0o644 });
renameSync(temporaryPath, SNAPSHOT_PATH);
console.log(`Wrote ${Object.keys(updated).length} updated / ${Object.keys(repos).length} total repo stats (${failed} failed) → public/live-snapshot.json`);
if (failed) process.exitCode = 1;
