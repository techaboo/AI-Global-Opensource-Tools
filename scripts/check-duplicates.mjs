/**
 * Structurally loads and validates the catalog and its checked-in live snapshot.
 * This command is read-only.
 *
 * Usage: node scripts/check-duplicates.mjs
 */
import {
  loadCatalog,
  readSnapshot,
  validateCatalog,
  validateSnapshot,
} from './catalog.mjs';

function printMessages(label, messages) {
  for (const message of messages) console[label](`${label === 'error' ? '✗' : '!'} ${message}`);
}

try {
  const catalog = await loadCatalog();
  const catalogResult = validateCatalog(catalog);
  const snapshotResult = validateSnapshot(readSnapshot(), catalog);
  const errors = [...catalogResult.errors, ...snapshotResult.errors];
  const warnings = [...catalogResult.warnings, ...snapshotResult.warnings];

  printMessages('warn', warnings);
  printMessages('error', errors);
  if (errors.length) {
    console.error(`\nCatalog validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
    process.exitCode = 1;
  } else {
    const repoCount = catalog.tools.filter(tool => tool.repo).length;
    console.log(`✓ Validated ${catalog.tools.length} tools, ${catalog.categories.length} categories, and ${repoCount} GitHub repo references (${warnings.length} warning(s)).`);
  }
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
