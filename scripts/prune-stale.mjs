/**
 * Removes stale tools from src/data/catalog.json: archived ones, and repos with
 * no push in 18 months (foundation models exempt from the inactivity rule). See
 * scripts/prune-lib.mjs. Removed repos are not added to excluded.json, so a
 * project that comes back to life can be discovered again.
 *
 * Needs a recent public/live-snapshot.json (`node scripts/live-data.mjs pull`).
 * Read-only unless --apply is given; --max caps removals per run so bad data can
 * never empty the catalog at once.
 *
 * Usage: node scripts/prune-stale.mjs [--apply] [--max=25]
 */
import { loadCatalog, readSnapshot, validateCatalog, writeCatalog } from './catalog.mjs';
import { selectStale } from './prune-lib.mjs';

const MAX_SNAPSHOT_AGE_MS = 3 * 86_400_000;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const maxArg = args.find(arg => arg.startsWith('--max='));
const max = maxArg ? Number(maxArg.split('=')[1]) : 25;
if (!Number.isInteger(max) || max <= 0) {
  console.error(`Invalid --max: ${JSON.stringify(maxArg)}`);
  process.exit(2);
}

const catalog = await loadCatalog();
const snapshot = readSnapshot();
if (!(Date.now() - Date.parse(snapshot.generatedAt) <= MAX_SNAPSHOT_AGE_MS)) {
  console.error(`Live snapshot is missing or older than 3 days (${snapshot.generatedAt}); refusing to judge staleness.`);
  process.exit(1);
}

const stale = selectStale(catalog.tools, snapshot);
const removing = stale.slice(0, max);
console.log(`${stale.length} stale tool(s); ${apply ? 'removing' : 'would remove'} ${removing.length}.`);
for (const { id, repo, reason } of removing) console.log(`  - ${id} (${repo}): ${reason}`);

if (!apply || removing.length === 0) process.exit(0);

const ids = new Set(removing.map(entry => entry.id));
const pruned = { ...catalog, tools: catalog.tools.filter(tool => !ids.has(tool.id)) };
const { errors } = validateCatalog(pruned);
if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}
writeCatalog(pruned);
console.log(`✓ Removed ${removing.length} tool(s); ${pruned.tools.length} remain.`);
