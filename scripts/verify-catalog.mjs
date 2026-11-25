/**
 * Read-only check of every catalog repository against live GitHub: dead links,
 * duplicates hiding behind renames, archived entries still marked active, and
 * pending renames.
 *
 * Fails (exit 1) when two entries are one repository, when more than 1% (at least
 * 4) of repositories could not be checked, or, with --base=<git ref>, when an
 * entry added since that ref is dead, archived or unchecked. A dead repo among
 * older entries is only reported: the 7-day 404 rule in fetch-stars.mjs decides
 * what happens to it.
 *
 * Usage: GITHUB_TOKEN=<token> node scripts/verify-catalog.mjs [--base=origin/main] [--report=path.md]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { ROOT, loadCatalog } from './catalog.mjs';
import { fetchRepoFacts } from './github.mjs';
import { assessCatalog, renderVerification } from './verify-lib.mjs';

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = option('base');
const reportPath = option('report');

const catalog = await loadCatalog();
let baseIds = null;
if (base) {
  const json = execFileSync('git', ['show', `${base}:src/data/catalog.json`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  baseIds = new Set(JSON.parse(json).tools.map(tool => tool.id));
}

const facts = await fetchRepoFacts(catalog.tools.filter(tool => tool.repo).map(tool => tool.repo), { token: process.env.GITHUB_TOKEN });
const result = assessCatalog(catalog.tools, facts, baseIds);
const report = renderVerification(result);
console.log(report);
if (reportPath) writeFileSync(reportPath, `${report}\n`);
if (result.failures.length) process.exitCode = 1;
