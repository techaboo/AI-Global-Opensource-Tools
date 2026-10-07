/**
 * Discovers candidate open-source AI repos via the GitHub Search API and drafts
 * new catalog entries using only GitHub-provided facts (name, owner, description,
 * license, language, topics, stars, creation year) — nothing generated or
 * invented. Appends drafts to src/data/tools.ts with `cat: 'TODO'`, a
 * deliberately invalid category that fails validateCatalog()/check-duplicates,
 * so CI stays red until a human assigns a real category and reviews the entry.
 * This script never commits or merges anything itself — see
 * .github/workflows/discover-tools.yml, which opens a draft PR instead.
 *
 * With TYPESAFE_API_KEY set, each surviving candidate also gets the semantic
 * duplicate check from typesafe-review.mjs, since an id/repo match alone misses
 * the same product republished under a different org. Optional; skipped cleanly
 * without the key, same as elsewhere TypeSafe is used in this repo.
 *
 * Usage: GITHUB_TOKEN=<token> node scripts/discover-tools.mjs [--limit=8]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG_PATH, loadCatalog } from './catalog.mjs';
import { DUPLICATE_THRESHOLD, reviewCandidate } from './typesafe-review.mjs';

const TOKEN = process.env.GITHUB_TOKEN || process.env.KIMI_GITHUB_API || '';
const MIN_STARS = 300;
const RECENT_DAYS = 30;
const TOPIC_QUERIES = [
  'topic:llm', 'topic:large-language-models', 'topic:ai-agents', 'topic:agents',
  'topic:generative-ai', 'topic:rag', 'topic:machine-learning', 'topic:computer-vision',
  'topic:nlp', 'topic:diffusion-models',
];

const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 8;
if (!Number.isInteger(limit) || limit <= 0) {
  console.error(`Invalid --limit: ${JSON.stringify(limitArg)}`);
  process.exit(2);
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function searchTopic(topic) {
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const q = `${topic} stars:>${MIN_STARS} pushed:>${since} fork:false archived:false`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osi-atlas-discover' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`https://api.github.com/search/repositories?${new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: '20' })}`, { headers });
  if (!res.ok) {
    console.warn(`! GitHub search failed for "${topic}" (${res.status}) — skipping.`);
    return [];
  }
  const json = await res.json();
  return json.items ?? [];
}

/** Returns a draft entry built only from repo's own GitHub metadata, or null if there isn't enough first-party info to catalog it. */
function toCandidate(repo) {
  const desc = repo.description?.trim();
  if (!desc) return null; // no first-party description to summarize from
  if (!repo.license?.spdx_id || repo.license.spdx_id === 'NOASSERTION') return null; // unverifiable license
  return {
    id: slugify(repo.name),
    name: repo.name,
    org: repo.owner.login,
    cat: 'TODO', // deliberately invalid — forces a human to assign a real category before merge
    tagline: desc.length > 80 ? `${desc.slice(0, 77)}...` : desc,
    desc,
    license: repo.license.spdx_id,
    lang: repo.language || 'Unknown',
    stars: repo.stargazers_count,
    repo: repo.full_name,
    tags: (repo.topics ?? []).slice(0, 5),
    status: 'active',
    year: new Date(repo.created_at).getUTCFullYear(),
  };
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatEntry(t) {
  const tags = t.tags.map(tag => `'${esc(tag)}'`).join(', ');
  return `  { id: '${t.id}', name: '${esc(t.name)}', org: '${esc(t.org)}', cat: '${t.cat}', tagline: '${esc(t.tagline)}', desc: '${esc(t.desc)}', license: '${esc(t.license)}', lang: '${esc(t.lang)}', stars: ${t.stars}, repo: '${t.repo}', tags: [${tags}], status: '${t.status}', year: ${t.year} },`;
}

const catalog = await loadCatalog();
const existingIds = new Set(catalog.tools.map(t => t.id));
const existingRepos = new Set(catalog.tools.filter(t => t.repo).map(t => t.repo.toLowerCase()));

const seen = new Map();
for (const topic of TOPIC_QUERIES) {
  for (const repo of await searchTopic(topic)) {
    if (!seen.has(repo.full_name)) seen.set(repo.full_name, repo);
  }
  await new Promise(resolve => setTimeout(resolve, 300)); // pace requests defensively
}

const rawCandidates = [];
for (const repo of seen.values()) {
  if (existingRepos.has(repo.full_name.toLowerCase())) continue;
  const candidate = toCandidate(repo);
  if (!candidate) continue;
  // Same base name as an existing entry, under a different repo coordinate — a
  // mirror, a rename, or a project squatting an established name to farm stars
  // (observed in testing: a decoy repo claiming more stars than the real one).
  // This is high suspicion, not a disambiguation detail — only an explicit
  // TypeSafe "not a duplicate" below should let it through.
  const nameCollision = existingIds.has(candidate.id);
  if (nameCollision) candidate.id = `${candidate.id}-${candidate.org.toLowerCase()}`;
  if (existingIds.has(candidate.id)) continue; // still colliding even after disambiguation — skip
  rawCandidates.push({ candidate, nameCollision });
}

// An id/repo collision only catches the exact same repo coordinate. Ask the
// TypeSafe semantic check too, same as the editorial review workflow does, so a
// renamed/mirrored/squatted duplicate doesn't make it into the draft PR.
const candidates = [];
for (const { candidate, nameCollision } of rawCandidates) {
  const result = await reviewCandidate(candidate, catalog);
  const flaggedDuplicate = !result.skipped && result.duplicates.some(d => d.noul >= DUPLICATE_THRESHOLD);
  if (flaggedDuplicate) {
    const best = result.duplicates[0];
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — likely duplicate of ${best.tool.name} (${best.tool.id}), noul ${best.noul.toFixed(2)}.`);
    continue;
  }
  if (nameCollision && result.skipped) {
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — shares a name with an existing entry and TYPESAFE_API_KEY is unset, so it can't be confirmed as a different project.`);
    continue;
  }
  candidates.push(candidate);
  if (candidates.length >= limit) break;
}

if (candidates.length === 0) {
  console.log('No new candidates found.');
  process.exit(0);
}

const source = readFileSync(CATALOG_PATH, 'utf8');
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const insertion = [
  '',
  `  // ─── Discovered ${new Date().toISOString().slice(0, 10)} — assign cat and review before merge ──`,
  ...candidates.map(formatEntry),
  '];',
].join(eol);
const updated = source.replace(
  new RegExp(`${eol}\\];${eol}${eol}export const ALL_LICENSES`),
  `${insertion}${eol}${eol}export const ALL_LICENSES`,
);
if (updated === source) {
  console.error('✗ Could not find the expected insertion point at the end of TOOLS in tools.ts.');
  process.exit(1);
}
writeFileSync(CATALOG_PATH, updated);

console.log(`✓ Drafted ${candidates.length} candidate(s) (cat: 'TODO' — CI will fail until reviewed):`);
for (const c of candidates) console.log(`  - ${c.name} (${c.repo})`);
