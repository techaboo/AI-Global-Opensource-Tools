/**
 * Discovers candidate open-source AI repos via the GitHub Search API and
 * auto-adds them to src/data/catalog.json using only GitHub-provided facts (name,
 * owner, description, license, language, topics, stars, creation year) —
 * nothing generated or invented. This script writes directly; it is the
 * workflow (.github/workflows/discover-tools.yml) that commits the result to
 * main, gated on `npm run check-duplicates` passing first.
 *
 * Requires TYPESAFE_API_KEY — every candidate must pass two live checks before
 * being added, both reusing one reviewCandidate() call (no extra cost):
 *   1. Semantic duplicate check — an id/repo match alone misses the same
 *      product republished under a different org (observed in testing).
 *   2. Category auto-assignment — only accepted at CATEGORY_CONFIDENCE or
 *      above; a low-confidence guess is skipped rather than miscategorized.
 * Without the key, nothing can be auto-categorized, so the run adds nothing
 * (logs why) rather than fabricate a category.
 *
 * Also filters out implausible star counts (stars per day since creation) —
 * observed in testing: a repo claiming more stars than the real project it
 * was squatting the name of, which the dedup check alone wouldn't catch for a
 * *non*-colliding name.
 *
 * Search shape (see scripts/discover-lib.mjs): per topic, a "new" window
 * (created in the last 90 days) and an "established" window (pushed in the last
 * 30 days), each paged and sorted by stars descending. The old single top-20
 * query was saturated by repos already in the catalog and re-reviewed the same
 * ~10 rejects every day. Candidates are now reviewed in stars-desc order
 * regardless of which query found them, and rejections are remembered in
 * audits/discover-rejects.json so they are not re-reviewed until their retry
 * date.
 *
 * Usage: GITHUB_TOKEN=<token> TYPESAFE_API_KEY=<key> node scripts/discover-tools.mjs [--limit=8]
 */
import { CATALOG_PATH, loadCatalog, loadExcluded, writeCatalog } from './catalog.mjs';
import {
  buildSearchPlan, classifyRepo, isRejectActive, pruneRejects, readRejects, recordReject, sortByStarsDesc, writeRejects,
} from './discover-lib.mjs';
import { DUPLICATE_THRESHOLD, reviewCandidate } from './typesafe-review.mjs';

const TOKEN = process.env.GITHUB_TOKEN || '';
const STARS_PER_DAY_CEILING = 1500; // generous even for a viral launch; past this, treat as likely farmed
const CATEGORY_CONFIDENCE = 0.6;
const PER_PAGE = 30;
const MAX_REVIEWS = 40; // caps TypeSafe calls per run; stars-desc order means the best candidates are reviewed first
// The authenticated Search API allows 30 requests/min; unauthenticated only 10.
const SEARCH_PACE_MS = TOKEN ? 2_200 : 6_500;
const TOPIC_QUERIES = [
  'topic:llm', 'topic:large-language-models', 'topic:ai-agents', 'topic:agents',
  'topic:generative-ai', 'topic:rag', 'topic:machine-learning', 'topic:computer-vision',
  'topic:nlp', 'topic:diffusion-models', 'topic:mcp', 'topic:model-context-protocol',
  'topic:llm-inference', 'topic:speech-recognition', 'topic:text-to-speech', 'topic:vector-database',
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Fetches one search page. Returns { items, rateLimited }; a failure yields no items rather than aborting the run. */
async function searchPage(q, page) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osi-atlas-discover' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const params = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: String(PER_PAGE), page: String(page) });
  const res = await fetch(`https://api.github.com/search/repositories?${params}`, { headers });
  if (!res.ok) {
    console.warn(`! GitHub search failed for "${q}" page ${page} (${res.status}) — skipping.`);
    return { items: [], rateLimited: res.status === 403 || res.status === 429 };
  }
  const json = await res.json();
  return { items: json.items ?? [], rateLimited: false };
}

/** Returns a draft entry built only from repo's own GitHub metadata, or null if it fails a cheap, deterministic filter. */
function toCandidate(repo) {
  const desc = repo.description?.trim();
  if (!desc) return null; // no first-party description to summarize from
  if (classifyRepo(repo)) return null; // not AI/ML software: a list, guide, course, book, or no AI signal at all
  if (!repo.license?.spdx_id || repo.license.spdx_id === 'NOASSERTION') return null; // unverifiable license

  const daysSinceCreated = Math.max(1, (Date.now() - new Date(repo.created_at).getTime()) / 86_400_000);
  if (repo.stargazers_count / daysSinceCreated > STARS_PER_DAY_CEILING) return null; // implausible growth, likely farmed/spam

  return {
    id: slugify(repo.name),
    name: repo.name,
    org: repo.owner.login,
    cat: 'uncategorized', // placeholder only — reviewCandidate() requires a truthy value but
    // ignores it when building the category question (only tagline/desc matter); always
    // overwritten with the real suggested category below, or the candidate is dropped
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

const catalog = await loadCatalog();
const existingIds = new Set(catalog.tools.map(t => t.id));
const existingRepos = new Set(catalog.tools.filter(t => t.repo).map(t => t.repo.toLowerCase()));
const excluded = loadExcluded();
const now = Date.now();
const rejects = pruneRejects(readRejects(), now);

const seen = new Map();
let rateLimited = false;
const found = { new: 0, established: 0 };
search:
for (const step of buildSearchPlan(TOPIC_QUERIES, now)) {
  for (let page = 1; page <= step.pages; page += 1) {
    const result = await searchPage(step.q, page);
    await sleep(SEARCH_PACE_MS);
    if (result.rateLimited) {
      rateLimited = true;
      console.warn('! GitHub search rate limit hit — reviewing what was collected so far.');
      break search;
    }
    for (const repo of result.items) {
      if (!seen.has(repo.full_name)) {
        seen.set(repo.full_name, repo);
        found[step.window] += 1;
      }
    }
    if (result.items.length < PER_PAGE) break; // last page for this query
  }
}

let alreadyCataloged = 0;
let rememberedRejects = 0;
let failedFilters = 0;
const rawCandidates = [];
// Stars descending, whichever query surfaced the repo — the catalog's ordering rule.
for (const repo of sortByStarsDesc([...seen.values()])) {
  if (existingRepos.has(repo.full_name.toLowerCase())) { alreadyCataloged += 1; continue; }
  if (excluded.has(repo.full_name.toLowerCase())) { rememberedRejects += 1; continue; } // permanent human decision
  if (isRejectActive(rejects[repo.full_name.toLowerCase()], now)) { rememberedRejects += 1; continue; }
  const candidate = toCandidate(repo);
  if (!candidate) { failedFilters += 1; continue; }
  // Same base name as an existing entry, under a different repo coordinate — a
  // mirror, a rename, or a project squatting an established name to farm stars.
  // High suspicion, not a disambiguation detail — only an explicit TypeSafe
  // "not a duplicate" below should let it through.
  const nameCollision = existingIds.has(candidate.id);
  if (nameCollision) candidate.id = `${candidate.id}-${candidate.org.toLowerCase()}`;
  if (existingIds.has(candidate.id)) continue; // still colliding even after disambiguation — skip
  rawCandidates.push({ candidate, nameCollision });
}

const candidates = [];
let reviewed = 0;
let newRejects = 0;
function reject(candidate, spec) {
  recordReject(rejects, candidate.repo, { ...spec, stars: candidate.stars }, now);
  newRejects += 1;
}

// try/finally so rejects recorded before a mid-run failure (e.g. a TypeSafe error) still persist.
try {
for (const { candidate, nameCollision } of rawCandidates) {
  if (reviewed >= MAX_REVIEWS) break;
  const result = await reviewCandidate(candidate, catalog);
  reviewed += 1;

  if (result.skipped) {
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — TYPESAFE_API_KEY is unset, so it can't be deduped or categorized.`);
    continue; // not a judgment about the repo, so nothing is remembered
  }

  const flaggedDuplicate = result.duplicates.some(d => d.noul >= DUPLICATE_THRESHOLD);
  if (flaggedDuplicate) {
    const best = result.duplicates[0];
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — likely duplicate of ${best.tool.name} (${best.tool.id}), noul ${best.noul.toFixed(2)}.`);
    reject(candidate, { kind: 'duplicate', reason: `duplicate of ${best.tool.id}`, score: best.noul });
    continue;
  }
  if (nameCollision && result.duplicates.length === 0) {
    // TypeSafe actively looked and found no match in the shortlist — but a name
    // collision is suspicious enough that an empty shortlist (not a confirmed
    // "different project") still isn't enough on its own. Require a real signal.
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — shares a name with an existing entry; no confident "different project" signal.`);
    reject(candidate, { kind: 'name', reason: 'shares a name with an existing entry' });
    continue;
  }

  if (result.category.confidence < CATEGORY_CONFIDENCE) {
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — category confidence too low (${result.category.confidence.toFixed(2)} < ${CATEGORY_CONFIDENCE}) to auto-assign.`);
    reject(candidate, { kind: 'category', reason: 'category confidence below threshold', score: result.category.confidence });
    continue;
  }
  candidate.cat = result.category.suggested;

  candidates.push(candidate);
  if (candidates.length >= limit) break;
}
} finally {
  writeRejects(rejects);
}

console.log(
  `Discovery summary: searched ${seen.size} unique repos (${found.new} via new-window, ${found.established} via established-window)`
  + `${rateLimited ? ' [rate limited]' : ''}; ${alreadyCataloged} already cataloged, ${rememberedRejects} remembered rejects, `
  + `${failedFilters} failed license/description/plausibility filters; reviewed ${reviewed} of ${rawCandidates.length} candidates, `
  + `${newRejects} newly rejected, ${candidates.length} added.`,
);

if (candidates.length === 0) {
  console.log('No new candidates added.');
  process.exit(0);
}

// Structured append: no source-text surgery, so catalog formatting can't break discovery.
catalog.tools.push(...candidates);
writeCatalog(catalog);
console.log(`✓ Wrote ${CATALOG_PATH}`);

console.log(`✓ Added ${candidates.length} candidate(s):`);
for (const c of candidates) console.log(`  - ${c.name} (${c.repo}) -> ${c.cat}`);
