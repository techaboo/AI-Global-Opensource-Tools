/**
 * Pure staleness rules for scripts/prune-stale.mjs.
 */
export const STALE_MONTHS = 18;
/** Categories where finished work rarely gets commits, so inactivity says nothing. */
export const INACTIVITY_EXEMPT = new Set(['models']);

const REVIVED_WINDOW_MS = 90 * 86_400_000;

/**
 * True when GitHub itself contradicts a catalog 'archived' flag: the repo is not
 * archived and was pushed recently (a temporary 404 or an unarchived project).
 * A quiet, unarchived repo keeps its flag, which may be an editorial decision.
 */
export function isRevived(repo, now = Date.now()) {
  return repo.archived === false && now - Date.parse(repo.pushed_at) <= REVIVED_WINDOW_MS;
}

/** Days a repo must keep returning 404 before it counts as deleted. */
export const MISSING_GRACE_DAYS = 7;

/**
 * Tracks when each tool's repo started returning 404. One 404 can be an outage or
 * a visibility blip, so only an unbroken run of MISSING_GRACE_DAYS confirms it.
 * A successful fetch resets the count; ids not checked this run keep theirs.
 * Returns { missing: { id: ISO first-404 time }, confirmed: [id] }.
 */
export function trackMissing(previous, { missingIds, foundIds, knownIds }, now = Date.now()) {
  const found = new Set(foundIds);
  const known = new Set(knownIds);
  const missing = Object.fromEntries(Object.entries(previous ?? {})
    .filter(([id, since]) => known.has(id) && !found.has(id) && Number.isFinite(Date.parse(since))));
  for (const id of missingIds) missing[id] ??= new Date(now).toISOString();
  const confirmed = missingIds.filter(id => now - Date.parse(missing[id]) >= MISSING_GRACE_DAYS * 86_400_000);
  return { missing, confirmed };
}

function monthsBefore(now, months) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.getTime();
}

/**
 * Tools to remove: archived ones in any category, plus (outside exempt
 * categories) repos with no push for `months`. A tool with no snapshot entry is
 * kept, since missing data is not evidence of abandonment.
 * Returns [{ id, repo, reason }], archived first, then longest-idle first.
 */
export function selectStale(tools, snapshot, now = Date.now(), months = STALE_MONTHS) {
  const cutoff = monthsBefore(now, months);
  const archived = [];
  const idle = [];
  for (const tool of tools) {
    if (tool.status === 'archived') {
      archived.push({ id: tool.id, repo: tool.repo, reason: 'archived' });
      continue;
    }
    if (INACTIVITY_EXEMPT.has(tool.cat)) continue;
    const pushedAt = snapshot.repos?.[tool.id]?.pushedAt;
    if (pushedAt && Date.parse(pushedAt) < cutoff) {
      idle.push({ id: tool.id, repo: tool.repo, pushedAt, reason: `no push since ${pushedAt.slice(0, 10)}` });
    }
  }
  idle.sort((a, b) => Date.parse(a.pushedAt) - Date.parse(b.pushedAt));
  return [...archived, ...idle];
}
