/**
 * Batched, read-only repository facts from the GitHub GraphQL API. One request
 * covers ${BATCH_SIZE} repos, so checking the whole catalog costs a few dozen
 * requests instead of one per tool (the REST approach outgrows the rate limit as
 * the catalog grows).
 */
export const BATCH_SIZE = 50;
const API_URL = 'https://api.github.com/graphql';
const FIELDS = 'nameWithOwner isArchived isDisabled stargazerCount forkCount pushedAt issues(states: OPEN) { totalCount } pullRequests(states: OPEN) { totalCount }';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** Pause between batches, to stay under GitHub's burst (secondary) limits. */
const PACE_MS = 750;
const MAX_LIMIT_WAIT_MS = 150_000;

/**
 * How long GitHub asks us to wait after a 403 or 429, or null when waiting that
 * long is not worth it. Burst limits clear in about a minute; an exhausted hourly
 * quota does not.
 */
export function limitWaitMs(headers, now = Date.now()) {
  const retryAfter = Number(headers?.get('retry-after'));
  let wait = 60_000;
  if (retryAfter > 0) wait = retryAfter * 1000;
  else if (headers?.get('x-ratelimit-remaining') === '0') wait = Number(headers.get('x-ratelimit-reset')) * 1000 - now;
  return wait <= MAX_LIMIT_WAIT_MS ? Math.max(wait, 1000) : null;
}

export function buildQuery(repos) {
  const parts = repos.map((repo, i) => {
    const [owner, name] = repo.split('/');
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${FIELDS} }`;
  });
  return `query { ${parts.join(' ')} }`;
}

const isCount = value => Number.isSafeInteger(value) && value >= 0;

/**
 * One repo's result: { status: 'ok', ...facts }, { status: 'missing' } (GitHub
 * says it does not exist, the GraphQL equivalent of a 404) or
 * { status: 'error', message } when nothing can be concluded.
 */
function toFact(node, error) {
  if (!node) {
    if (error?.type === 'NOT_FOUND') return { status: 'missing' };
    return { status: 'error', message: error?.message ?? 'GitHub returned no data' };
  }
  const openIssues = node.issues?.totalCount + node.pullRequests?.totalCount;
  if (![node.stargazerCount, node.forkCount, openIssues].every(isCount)) return { status: 'error', message: 'GitHub response has invalid counts' };
  if (typeof node.pushedAt !== 'string' || !Number.isFinite(Date.parse(node.pushedAt))) return { status: 'error', message: 'GitHub response has invalid pushedAt' };
  return {
    status: 'ok',
    nameWithOwner: node.nameWithOwner,
    archived: node.isArchived === true || node.isDisabled === true,
    stars: node.stargazerCount,
    forks: node.forkCount,
    openIssues,
    pushedAt: node.pushedAt,
  };
}

/**
 * Returns a Map from each requested "owner/name" to its fact. Transient failures
 * are retried; a rate limit stops further requests and marks the rest 'error'.
 */
export async function fetchRepoFacts(repos, { token, retries = 3, retryDelayMs = 2_000, paceMs = PACE_MS } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is required: the GitHub GraphQL API does not accept anonymous requests.');
  const results = new Map();
  let rateLimited = false;
  for (let start = 0; start < repos.length; start += BATCH_SIZE) {
    const batch = repos.slice(start, start + BATCH_SIZE);
    let failure = rateLimited ? 'GitHub request limit reached' : '';
    let body = null;
    let done = false;
    if (start > 0 && !failure) await sleep(paceMs);
    for (let attempt = 0; !failure && !done; attempt += 1) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'osi-atlas' },
          signal: AbortSignal.timeout(60_000),
          body: JSON.stringify({ query: buildQuery(batch) }),
        });
        if (response.status === 403 || response.status === 429) {
          const wait = limitWaitMs(response.headers);
          if (wait !== null && attempt < retries) {
            console.warn(`! GitHub request limit (${response.status}); waiting ${Math.round(wait / 1000)}s.`);
            await sleep(wait);
            continue;
          }
          rateLimited = true;
          failure = `GitHub request limit reached (${response.status})`;
          break;
        }
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const json = await response.json();
        if (json.errors?.some(e => e.type === 'RATE_LIMITED')) {
          rateLimited = true;
          failure = 'GitHub request limit reached';
          break;
        }
        if (!json.data) throw new Error(json.errors?.[0]?.message ?? 'GitHub returned no data');
        body = json;
        // A single repository can fail (a query timeout) while the rest answer.
        const partial = json.errors?.some(e => e.type !== 'NOT_FOUND');
        done = !partial || attempt >= retries;
        if (!done) await sleep(retryDelayMs * 2 ** attempt);
      } catch (error) {
        if (attempt < retries) await sleep(retryDelayMs * 2 ** attempt);
        else if (body) done = true; // keep the earlier partial answer
        else failure = error.message;
      }
    }
    batch.forEach((repo, i) => {
      results.set(repo, body && !failure
        ? toFact(body.data[`r${i}`], body.errors?.find(e => e.path?.[0] === `r${i}`))
        : { status: 'error', message: failure });
    });
  }
  return results;
}
