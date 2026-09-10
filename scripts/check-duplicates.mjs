/**
 * Fails if src/data/tools.ts has two entries with the same `id` or the same `repo`
 * (case-insensitive). Catches the most likely mistake an automated catalog-update
 * agent could make: re-adding a tool that's already there.
 *
 * Usage: node scripts/check-duplicates.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/data/tools.ts'), 'utf8');

const seenIds = new Map();
const seenRepos = new Map();
let lineNo = 0;
let failed = false;
let inToolsArray = false;

for (const line of src.split('\n')) {
  lineNo++;
  if (!inToolsArray) {
    if (line.includes('export const TOOLS')) inToolsArray = true;
    continue; // skip CATEGORIES entries above TOOLS, which also have an `id` field
  }
  const idMatch = line.match(/^\s*\{\s*id:\s*'([^']+)'/);
  if (!idMatch) continue;
  const id = idMatch[1];
  const repoMatch = line.match(/\brepo:\s*'([^']+)'/);
  const repo = repoMatch ? repoMatch[1].toLowerCase() : null;

  if (seenIds.has(id)) {
    console.error(`✗ Duplicate id '${id}' at line ${lineNo} (first seen at line ${seenIds.get(id)})`);
    failed = true;
  } else {
    seenIds.set(id, lineNo);
  }

  if (repo) {
    if (seenRepos.has(repo)) {
      console.error(`✗ Duplicate repo '${repo}' at line ${lineNo} (first seen at line ${seenRepos.get(repo)})`);
      failed = true;
    } else {
      seenRepos.set(repo, lineNo);
    }
  }
}

if (failed) {
  console.error(`\nFound duplicates among ${seenIds.size} entries. Fix src/data/tools.ts before merging.`);
  process.exit(1);
}
console.log(`✓ No duplicate ids or repos among ${seenIds.size} catalog entries.`);
