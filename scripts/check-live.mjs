/**
 * Waits until the published site was built from this checkout's catalog. The tool
 * count alone cannot tell: a day can add as many entries as it removes.
 *
 * Usage: node scripts/check-live.mjs <site url> [--attempts=40]
 */
import { catalogHash, loadCatalog } from './catalog.mjs';

const site = process.argv[2]?.replace(/\/$/, '');
if (!site) {
  console.error('Usage: node scripts/check-live.mjs <site url> [--attempts=40]');
  process.exit(2);
}
const attempts = Number(process.argv.find(arg => arg.startsWith('--attempts='))?.split('=')[1] ?? 40);
const catalog = await loadCatalog();
const expected = catalogHash(catalog);

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  let seen = 'unreachable';
  try {
    const response = await fetch(`${site}/api/v1/meta.json?check=${Date.now()}`, { signal: AbortSignal.timeout(20_000) });
    if (response.ok) {
      const meta = await response.json();
      if (meta.catalogHash === expected) {
        console.log(`Live site serves this catalog (${meta.toolCount} tools).`);
        process.exit(0);
      }
      seen = `${meta.toolCount} tools, different catalog`;
    }
  } catch (error) {
    seen = error.message;
  }
  console.log(`Attempt ${attempt}: live site is ${seen}; expected ${catalog.tools.length} tools.`);
  if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 20_000));
}
console.error('::error::The live site does not serve the catalog that was published.');
process.exit(1);
