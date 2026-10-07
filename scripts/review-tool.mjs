/**
 * CLI for scripts/typesafe-review.mjs. Reviews one tool for suspected duplicates,
 * a mismatched category, and implausible metadata before it's merged.
 *
 * Usage: node scripts/review-tool.mjs <existing-catalog-id>
 *        node scripts/review-tool.mjs path/to/candidate.json
 *
 * Requires TYPESAFE_API_KEY: TYPESAFE_API_KEY=<key> node scripts/review-tool.mjs <id>
 * Without it, prints a notice and exits 0 so this never blocks `npm run validate`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { loadCatalog } from './catalog.mjs';
import { DUPLICATE_THRESHOLD, reviewCandidate } from './typesafe-review.mjs';

const [arg] = process.argv.slice(2);
if (!arg) {
  console.error('Usage: node scripts/review-tool.mjs <existing-catalog-id | path/to/candidate.json>');
  process.exit(2);
}

const catalog = await loadCatalog();

let candidate;
if (existsSync(arg) && arg.endsWith('.json')) {
  candidate = JSON.parse(readFileSync(arg, 'utf8'));
  candidate.id ??= `candidate-${Date.now()}`;
} else {
  candidate = catalog.tools.find(tool => tool.id === arg);
  if (!candidate) {
    console.error(`✗ No catalog tool with id ${JSON.stringify(arg)}, and no such JSON file.`);
    process.exit(2);
  }
}

const result = await reviewCandidate(candidate, catalog);

if (result.skipped) {
  console.log(`Skipped: ${result.reason}. Set TYPESAFE_API_KEY to run the semantic review.`);
  process.exit(0);
}

console.log(`Review for ${candidate.name} (${candidate.id}):\n`);

if (result.duplicates.length === 0) {
  console.log('✓ No suspected duplicates in the shortlist.');
} else {
  console.log('! Suspected duplicate(s):');
  for (const { tool, noul } of result.duplicates) {
    console.log(`  - ${tool.name} (${tool.id}) — noul ${noul.toFixed(2)}`);
  }
}

const { category } = result;
if (category.matchesCurrent) {
  console.log(`✓ Category "${category.current}" matches the model's suggestion (confidence ${category.confidence.toFixed(2)}).`);
} else {
  console.log(`! Category mismatch: catalog says "${category.current}", model suggests "${category.suggested}" (confidence ${category.confidence.toFixed(2)}).`);
}

const { metadata } = result;
if (metadata.licenseConflict >= 0.5) console.log(`! Possible license conflict (noul ${metadata.licenseConflict.toFixed(2)}): description may contradict an open-source license.`);
else console.log(`✓ No license conflict detected (noul ${metadata.licenseConflict.toFixed(2)}).`);

if (metadata.taglineAccurate < 0.5) console.log(`! Tagline may not accurately reflect the description (noul ${metadata.taglineAccurate.toFixed(2)}).`);
else console.log(`✓ Tagline appears accurate (noul ${metadata.taglineAccurate.toFixed(2)}).`);

console.log(`  Status plausibility: ${metadata.statusPlausibility.score.toFixed(2)}/2 — ${metadata.statusPlausibility.legend[String(Math.round(metadata.statusPlausibility.score))]}`);

const strongDuplicate = result.duplicates.some(({ noul }) => noul >= 0.85);
if (strongDuplicate) {
  console.error(`\n✗ High-confidence duplicate found (noul ≥ 0.85). Review before merging.`);
  process.exit(1);
}
if (result.duplicates.some(({ noul }) => noul >= DUPLICATE_THRESHOLD)) {
  console.log(`\nReview the suspected duplicate(s) above before merging; none are high-confidence.`);
}
