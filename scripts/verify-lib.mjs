/**
 * Pure assessment for scripts/verify-catalog.mjs.
 */

/**
 * Older entries GitHub will not answer for (blocked or restricted repositories)
 * are tolerated up to this share; beyond it the check itself is not trustworthy.
 */
export const UNCHECKED_TOLERANCE = 0.01;

/** Returns counts, findings and the subset of findings that must fail the run. */
export function assessCatalog(tools, facts, baseIds = null) {
  const dead = [];
  const unchecked = [];
  const archived = [];
  const renamed = [];
  const byRepo = new Map();
  const added = baseIds ? tools.filter(tool => !baseIds.has(tool.id)) : [];
  for (const tool of tools) {
    if (!tool.repo) {
      if (baseIds && !baseIds.has(tool.id)) unchecked.push({ id: tool.id, repo: 'no repository', message: 'nothing to verify against' });
      continue;
    }
    const fact = facts.get(tool.repo);
    const canonical = fact?.status === 'ok' ? fact.nameWithOwner : tool.repo;
    const key = canonical.toLowerCase();
    byRepo.set(key, [...(byRepo.get(key) ?? []), tool.id]);
    if (fact?.status === 'missing') dead.push({ id: tool.id, repo: tool.repo });
    else if (fact?.status !== 'ok') unchecked.push({ id: tool.id, repo: tool.repo, message: fact?.message ?? 'not requested' });
    else {
      if (fact.archived && tool.status !== 'archived') archived.push({ id: tool.id, repo: tool.repo });
      if (key !== tool.repo.toLowerCase()) renamed.push({ id: tool.id, repo: tool.repo, to: canonical });
    }
  }
  const duplicates = [...byRepo].filter(([, ids]) => ids.length > 1).map(([repo, ids]) => ({ repo, ids }));

  const addedIds = new Set(added.map(tool => tool.id));
  const allowed = Math.max(3, Math.floor(tools.length * UNCHECKED_TOLERANCE));
  const blocking = unchecked.length > allowed ? unchecked : unchecked.filter(u => addedIds.has(u.id));
  const failures = [
    ...duplicates.map(d => `duplicate repository ${d.repo}: ${d.ids.join(', ')}`),
    ...blocking.map(u => `could not verify ${u.id} (${u.repo}): ${u.message}`),
    ...dead.filter(d => addedIds.has(d.id)).map(d => `new entry ${d.id} points to a missing repository ${d.repo}`),
    ...archived.filter(a => addedIds.has(a.id)).map(a => `new entry ${a.id} is archived on GitHub`),
  ];
  return { total: tools.length, added: added.length, dead, unchecked, archived, renamed, duplicates, failures };
}

export function renderVerification(result) {
  const lines = [
    '# Catalog verification',
    '',
    `Checked: ${new Date().toISOString()}`,
    `Entries: ${result.total} (added since base: ${result.added})`,
    `Dead repositories: ${result.dead.length} · duplicates: ${result.duplicates.length} · archived but active: ${result.archived.length} · pending renames: ${result.renamed.length} · unverified: ${result.unchecked.length}`,
  ];
  const section = (title, rows) => { if (rows.length) lines.push('', `## ${title}`, ...rows.map(row => `- ${row}`)); };
  section('Failures', result.failures);
  section('Could not be verified', result.unchecked.map(u => `${u.id}: ${u.repo} (${u.message})`));
  section('Dead repositories', result.dead.map(d => `${d.id}: ${d.repo}`));
  section('Archived on GitHub', result.archived.map(a => `${a.id}: ${a.repo}`));
  section('Renamed on GitHub', result.renamed.map(r => `${r.id}: ${r.repo} -> ${r.to}`));
  if (!result.failures.length) lines.push('', 'PASS');
  return lines.join('\n');
}
