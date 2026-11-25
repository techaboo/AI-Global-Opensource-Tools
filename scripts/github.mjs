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
export async function fetchRepoFacts(repos, { token, retries = 3, retryDelayMs = 2_000 } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is required: the GitHub GraphQL API does not accept anonymous requests.');
  const results = new Map();
  let rateLimited = false;
  for (let start = 0; start < repos.length; start += BATCH_SIZE) {
    const batch = repos.slice(start, start + BATCH_SIZE);
    let failure = rateLimited ? 'GitHub request limit reached' : '';
    let body = null;
    for (let attempt = 0; !failure && !body; attempt += 1) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'osi-atlas' },
          body: JSON.stringify({ query: buildQuery(batch) }),
        });
        if (response.status === 403 || response.status === 429) {
          rateLimited = true;
          failure = 'GitHub request limit reached';
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
      } catch (error) {
        if (attempt >= retries) failure = error.message;
        else await sleep(retryDelayMs * 2 ** attempt);
      }
    }
    batch.forEach((repo, i) => {
      results.set(repo, body
        ? toFact(body.data[`r${i}`], body.errors?.find(e => e.path?.[0] === `r${i}`))
        : { status: 'error', message: failure });
    });
  }
  return results;
}
