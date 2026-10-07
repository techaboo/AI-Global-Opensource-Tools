/**
 * Generates a static, read-only JSON API from the catalog, written into public/
 * so `vite build` copies it straight into dist/ alongside the SPA — no backend
 * needed, consistent with this being a fully static site. Re-run on every build;
 * output is not checked in (see .gitignore) since it's fully derived from
 * src/data/tools.ts, which already is.
 *
 * Usage: node scripts/generate-api.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadCatalog, validateCatalog } from './catalog.mjs';

const API_DIR = join(ROOT, 'public/api/v1');
const SCHEMA_VERSION = 1;

const catalog = await loadCatalog();
const { errors } = validateCatalog(catalog);
if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  console.error('Refusing to generate the API from an invalid catalog.');
  process.exit(1);
}

mkdirSync(API_DIR, { recursive: true });

const meta = {
  generatedAt: new Date().toISOString(),
  schemaVersion: SCHEMA_VERSION,
  toolCount: catalog.tools.length,
  categoryCount: catalog.categories.length,
  snapshotDate: catalog.snapshotDate,
};

writeFileSync(join(API_DIR, 'tools.json'), `${JSON.stringify(catalog.tools, null, 2)}\n`);
writeFileSync(join(API_DIR, 'categories.json'), `${JSON.stringify(catalog.categories, null, 2)}\n`);
writeFileSync(join(API_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

console.log(`✓ Generated public/api/v1/{tools,categories,meta}.json (${catalog.tools.length} tools, ${catalog.categories.length} categories).`);
