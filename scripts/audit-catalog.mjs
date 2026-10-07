/**
 * Batch-runs the TypeSafe semantic review (typesafe-review.mjs) across a rotating
 * slice of the catalog. State in audits/state.json tracks which tools have been
 * reviewed and when, so each run picks up the least-recently-reviewed tools —
 * the whole catalog rotates through on a roughly quarterly cadence (at the
 * default batch size) rather than reviewing, and paying for, all ~500+ tools
 * every run. See .github/workflows/typesafe-audit.yml for the scheduled job.
 *
 * Usage: node scripts/audit-catalog.mjs [--batch-size=50] [--dry-run]
 * Requires TYPESAFE_API_KEY; exits 0 having reviewed nothing when it's unset.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, loadCatalog } from './catalog.mjs';
import { reviewCandidate } from './typesafe-review.mjs';
import { DEFAULT_BATCH_SIZE, classify, renderReport, selectBatch } from './typesafe-audit.mjs';

const STATE_PATH = join(ROOT, 'audits/state.json');
const REPORT_PATH = join(ROOT, 'audits/latest-report.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : DEFAULT_BATCH_SIZE;
if (!Number.isInteger(batchSize) || batchSize <= 0) {
  console.error(`Invalid --batch-size: ${JSON.stringify(batchSizeArg)}`);
  process.exit(2);
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const catalog = await loadCatalog();
const state = loadState();
const batch = selectBatch(catalog.tools, state, batchSize);

const flagged = [];
let reviewedCount = 0;

for (const tool of batch) {
  const result = await reviewCandidate(tool, catalog);
  if (result.skipped) break;
  reviewedCount++;
  const reasons = classify(tool, result);
  state[tool.id] = { reviewedAt: new Date().toISOString(), flagged: reasons.length > 0 };
  if (reasons.length > 0) flagged.push({ tool, reasons });
}

if (reviewedCount === 0) {
  console.log('Skipped: TYPESAFE_API_KEY is not set. Nothing reviewed.');
  process.exit(0);
}

const coverage = catalog.tools.filter(tool => state[tool.id]?.reviewedAt).length;
const report = renderReport({
  reviewedCount,
  requestedCount: batch.length,
  batchSize,
  coverage,
  totalTools: catalog.tools.length,
  flagged,
});

console.log(report);

if (!dryRun) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  writeFileSync(REPORT_PATH, `${report}\n`);
}
