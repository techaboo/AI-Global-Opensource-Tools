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
 * Search shape (see scripts/discover-lib.mjs): every catalog category has its
 * own GitHub topics, and per topic there is a "new" window (created in the last
 * 90 days) and an "established" window (pushed in the last 30 days), sorted by
 * stars descending. The review queue takes one candidate per category in turn,
 * thinnest category first and stars descending within each, and one run adds
 * only a few tools to any single category. Rejections are remembered in
 * audits/discover-rejects.json so they are not re-reviewed until their retry
 * date.
 *
 * A run aims for at least --min additions. While it is short it widens the search
 * (SEARCH_TIERS), then relaxes only the per-category cap for candidates that
 * already passed every check. If it still ends short it says so and reports
 * `short=true` to the workflow; it never lowers a quality check to hit a number.
 *
 * The run also has a time budget (--max-minutes): searching stops ten minutes
 * before it ends and reviewing stops when it ends, so what was accepted is always
 * written before the job could time out.
 *
 * Usage: GITHUB_TOKEN=<token> TYPESAFE_API_KEY=<key> node scripts/discover-tools.mjs [--limit=45] [--min=30] [--max-minutes=45]
 */
import { appendFileSync } from 'node:fs';
import { CATALOG_PATH, loadCatalog, loadExcluded, writeCatalog } from './catalog.mjs';
import {
  CATEGORY_TOPICS, SEARCH_TIERS, backfill, buildSearchPlan, categoriesByNeed, classifyRepo, interleaveByCategory, isRejectActive, pruneRejects,
  readRejects, recordReject, sortByStarsDesc, writeRejects,
} from './discover-lib.mjs';
import { DUPLICATE_THRESHOLD, reviewCandidate } from './typesafe-review.mjs';

const TOKEN = process.env.GITHUB_TOKEN || '';
const STARS_PER_DAY_CEILING = 1500; // generous even for a viral launch; past this, treat as likely farmed
const CATEGORY_CONFIDENCE = 0.6;
const PER_PAGE = 30;
const MAX_REVIEWS = 400; // caps TypeSafe calls per run; each category's best candidates are reviewed first
const MAX_CONSECUTIVE_ERRORS = 3; // one bad response is skipped; a run of them means the service is down
// The authenticated Search API allows 30 requests/min; unauthenticated only 10.
const SEARCH_PACE_MS = TOKEN ? 2_200 : 6_500;

const args = process.argv.slice(2);
function intArg(name, fallback) {
  const arg = args.find(value => value.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split('=')[1]) : fallback;
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`Invalid --${name}: ${JSON.stringify(arg)}`);
    process.exit(2);
  }
  return value;
}
const limit = intArg('limit', 45);
const minimum = Math.min(intArg('min', 30), limit);
const budgetMs = intArg('max-minutes', 45) * 60_000;
const startedAt = Date.now();
const deadline = startedAt + budgetMs;
const searchDeadline = deadline - Math.min(10 * 60_000, budgetMs / 3);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Fetches one search page. Returns { items, rateLimited }; a failure yields no items rather than aborting the run. */
async function searchPage(q, page, attempt = 1) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osi-atlas-discover' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const params = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: String(PER_PAGE), page: String(page) });
  let res;
  let json;
  try {
    res = await fetch(`https://api.github.com/search/repositories?${params}`, { headers, signal: AbortSignal.timeout(30_000) });
    if (res.ok) json = await res.json();
  } catch (error) {
    if (attempt === 1) {
      await sleep(5_000);
      return searchPage(q, page, 2);
    }
    console.warn(`! GitHub search failed for "${q}" page ${page} (${error.message}) — skipping.`);
    return { items: [], rateLimited: false };
  }
  const limited = res.status === 403 || res.status === 429;
  if (!res.ok && attempt === 1 && (limited || res.status >= 500)) {
    await sleep(limited ? 65_000 : 5_000); // the search limit resets every minute
    return searchPage(q, page, 2);
  }
  if (!res.ok) {
    console.warn(`! GitHub search failed for "${q}" page ${page} (${res.status}) — skipping.`);
    return { items: [], rateLimited: limited };
  }
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

  const id = slugify(repo.name);
  if (!id) return null; // no ASCII name to build a stable id from
  const topics = (repo.topics ?? []).slice(0, 5);
  if (repo.archived || repo.fork || repo.disabled) return null;

  return {
    id,
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
    tags: topics.length ? topics : ['ai'], // validation requires at least one tag
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

const needOrder = categoriesByNeed(catalog.categories, catalog.tools);
// At most this many additions per category before the backfill pass, so one busy topic can't fill the day.
const perCategory = Math.max(2, Math.ceil(limit / needOrder.length));

const seen = new Set(); // full_name, lowercased, across all tiers
let rateLimited = false;
const found = { new: 0, established: 0 };

/** Runs one search tier. Returns Map category hint -> candidates not seen before, stars descending. */
async function searchTier(tier) {
  const fresh = new Map(); // full_name -> { repo, hint }; thinnest categories search first, so they claim shared hits
  // The first tier may use the whole search window; a widened one gets half of
  // what is left, so its candidates still have time to be reviewed.
  const left = Math.max(0, searchDeadline - Date.now());
  const tierDeadline = Date.now() + (tiersUsed === 1 ? left : left / 2);
  search:
  for (const hint of needOrder) {
    const topics = (CATEGORY_TOPICS[hint] ?? []).map(topic => `topic:${topic}`);
    for (const step of buildSearchPlan(topics, now, tier)) {
      for (let page = 1; page <= step.pages; page += 1) {
        if (Date.now() >= tierDeadline) break search;
        const result = await searchPage(step.q, page);
        await sleep(SEARCH_PACE_MS);
        if (result.rateLimited) {
          rateLimited = true;
          console.warn('! GitHub search rate limit hit — reviewing what was collected so far.');
          break search;
        }
        for (const repo of result.items) {
          const key = repo.full_name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            fresh.set(key, { repo, hint });
            found[step.window] += 1;
          }
        }
        if (result.items.length < PER_PAGE) break; // last page for this query
      }
    }
  }

  const queues = new Map();
  for (const repo of sortByStarsDesc([...fresh.values()].map(entry => entry.repo))) {
    const key = repo.full_name.toLowerCase();
    if (existingRepos.has(key)) { alreadyCataloged += 1; continue; }
    if (excluded.has(key)) { rememberedRejects += 1; continue; } // permanent human decision
    if (isRejectActive(rejects[key], now)) { rememberedRejects += 1; continue; }
    const candidate = toCandidate(repo);
    if (!candidate) { failedFilters += 1; continue; }
    const { hint } = fresh.get(key);
    if (!queues.has(hint)) queues.set(hint, []);
    queues.get(hint).push(candidate);
    eligible += 1;
  }
  return queues;
}

let alreadyCataloged = 0;
let rememberedRejects = 0;
let failedFilters = 0;
let eligible = 0;

const candidates = [];
const deferred = []; // passed every check, held back by the per-category cap
const addedPerCategory = new Map();
const takenNames = new Set(catalog.tools.map(t => t.name.trim().toLowerCase()));
let reviewed = 0;
let newRejects = 0;
let errors = 0;
let consecutiveErrors = 0;
let tiersUsed = 0;
let stopped = false; // reviews cannot continue
function reject(candidate, spec) {
  recordReject(rejects, candidate.repo, { ...spec, stars: candidate.stars }, now);
  newRejects += 1;
}

function accept(candidate) {
  addedPerCategory.set(candidate.cat, (addedPerCategory.get(candidate.cat) ?? 0) + 1);
  catalog.tools.push(candidate); // later candidates are deduped against this one too
  candidates.push(candidate);
}

async function review(candidate) {
  // Same base name as an existing entry (or one accepted earlier in this run),
  // under a different repo coordinate — a mirror, a rename, or a project
  // squatting an established name to farm stars. High suspicion, not a
  // disambiguation detail — only an explicit TypeSafe "not a duplicate" below
  // should let it through. Ids and names must both stay unique to pass validation.
  const nameCollision = existingIds.has(candidate.id) || takenNames.has(candidate.name.toLowerCase());
  if (nameCollision) {
    candidate.id = `${candidate.id}-${slugify(candidate.org)}`;
    candidate.name = `${candidate.name} (${candidate.org})`;
  }
  if (existingIds.has(candidate.id) || takenNames.has(candidate.name.toLowerCase())) return; // still colliding

  let result;
  try {
    // Deferred candidates may still be added, so they count as existing too.
    result = await reviewCandidate(candidate, { ...catalog, tools: [...catalog.tools, ...deferred] });
    consecutiveErrors = 0;
  } catch (error) {
    errors += 1;
    consecutiveErrors += 1;
    console.warn(`! Review failed for ${candidate.name} (${candidate.repo}): ${error.message}`);
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      if (candidates.length === 0) throw error; // nothing to save, so fail the run visibly
      console.warn('! Too many review failures in a row — keeping what was accepted so far.');
      stopped = true;
    }
    return;
  }

  if (result.skipped) {
    console.log('! TYPESAFE_API_KEY is unset, so nothing can be deduped or categorized.');
    stopped = true; // not a judgment about any repo, so nothing is remembered
    return;
  }
  reviewed += 1;

  const flaggedDuplicate = result.duplicates.some(d => d.noul >= DUPLICATE_THRESHOLD);
  if (flaggedDuplicate) {
    const best = result.duplicates[0];
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — likely duplicate of ${best.tool.name} (${best.tool.id}), noul ${best.noul.toFixed(2)}.`);
    reject(candidate, { kind: 'duplicate', reason: `duplicate of ${best.tool.id}`, score: best.noul });
    return;
  }
  if (nameCollision && result.duplicates.length === 0) {
    // TypeSafe actively looked and found no match in the shortlist — but a name
    // collision is suspicious enough that an empty shortlist (not a confirmed
    // "different project") still isn't enough on its own. Require a real signal.
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — shares a name with an existing entry; no confident "different project" signal.`);
    reject(candidate, { kind: 'name', reason: 'shares a name with an existing entry' });
    return;
  }

  if (result.category.confidence < CATEGORY_CONFIDENCE) {
    console.log(`! Skipping ${candidate.name} (${candidate.repo}) — category confidence too low (${result.category.confidence.toFixed(2)} < ${CATEGORY_CONFIDENCE}) to auto-assign.`);
    reject(candidate, { kind: 'category', reason: 'category confidence below threshold', score: result.category.confidence });
    return;
  }
  candidate.cat = result.category.suggested;
  // Reserve the id and name now, so a deferred candidate can't be duplicated by a later one.
  existingIds.add(candidate.id);
  takenNames.add(candidate.name.toLowerCase());
  if ((addedPerCategory.get(candidate.cat) ?? 0) >= perCategory) deferred.push(candidate);
  else accept(candidate);
}

// try/finally so rejects recorded before a mid-run failure still persist.
try {
  for (const tier of SEARCH_TIERS) {
    tiersUsed += 1;
    const queues = await searchTier(tier);
    for (const candidate of interleaveByCategory(queues, needOrder)) {
      if (stopped || reviewed >= MAX_REVIEWS || candidates.length >= limit || Date.now() >= deadline) break;
      await review(candidate);
    }
    if (stopped || rateLimited || reviewed >= MAX_REVIEWS || candidates.length + deferred.length >= minimum || Date.now() >= searchDeadline) break;
  }
  for (const candidate of backfill(deferred, addedPerCategory, perCategory, minimum - candidates.length)) accept(candidate);
} finally {
  writeRejects(rejects);
}

const short = candidates.length < minimum;
console.log(
  `Discovery summary: searched ${seen.size} unique repos in ${tiersUsed} tier(s) (${found.new} via new-window, ${found.established} via established-window)`
  + `${rateLimited ? ' [rate limited]' : ''}; ${alreadyCataloged} already cataloged, ${rememberedRejects} remembered rejects, `
  + `${failedFilters} failed license/description/plausibility filters; reviewed ${reviewed} of ${eligible} candidates, `
  + `${newRejects} newly rejected, ${errors} review errors, ${candidates.length} added across ${new Set(candidates.map(c => c.cat)).size} categories `
  + `(minimum ${minimum}${short ? ', NOT MET' : ', met'}).`,
);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `added=${candidates.length}\nshort=${short}\n`);

if (candidates.length === 0) {
  console.log('No new candidates added.');
  process.exit(0);
}

// Structured write: no source-text surgery, so catalog formatting can't break discovery.
writeCatalog({ ...catalog, snapshotDate: new Date(now).toISOString().slice(0, 10) });
console.log(`✓ Wrote ${CATALOG_PATH}`);

console.log(`✓ Added ${candidates.length} candidate(s):`);
for (const c of candidates) console.log(`  - ${c.name} (${c.repo}) -> ${c.cat}`);
