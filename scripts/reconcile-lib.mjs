/**
 * Pure rules that keep catalog repo coordinates matching GitHub. GitHub redirects
 * renamed repositories, so an old and a new name both "work" while pointing at one
 * project: exact-string duplicate checks cannot see that.
 */

/** A run that wants to remove more entries than this is treated as bad data. */
export const MAX_REMOVALS = 10;

const lower = value => value.toLowerCase();

/**
 * Applies GitHub's canonical names to `tools`. Entries that resolve to the same
 * repository are merged: the one already using the canonical name is kept,
 * otherwise the earliest entry. Entries renamed onto a repo a human excluded are
 * removed. Tools without a successful lookup keep their current coordinate.
 * Returns { tools, renamed: [{ id, from, to }], removed: [{ id, repo, reason, keptId }] }.
 */
export function reconcileRepos(tools, facts, excluded = new Map()) {
  const canonical = tool => {
    const fact = facts.get(tool.repo);
    return fact?.status === 'ok' ? fact.nameWithOwner : tool.repo;
  };
  const groups = new Map();
  for (const tool of tools) {
    if (!tool.repo) continue;
    const key = lower(canonical(tool));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tool);
  }

  const removed = [];
  const renames = new Map();
  for (const [key, group] of groups) {
    const reason = excluded.get(key);
    if (reason) {
      for (const tool of group) removed.push({ id: tool.id, repo: tool.repo, reason: `moved to excluded repo (${reason})` });
      continue;
    }
    const keeper = group.find(tool => lower(tool.repo) === key) ?? group[0];
    for (const tool of group) {
      if (tool !== keeper) removed.push({ id: tool.id, repo: tool.repo, reason: `same repository as ${keeper.id}`, keptId: keeper.id });
    }
    const to = canonical(keeper);
    if (lower(to) !== lower(keeper.repo)) renames.set(keeper.id, to);
  }

  const dropped = new Set(removed.map(entry => entry.id));
  const renamed = [];
  const out = tools.filter(tool => !dropped.has(tool.id)).map(tool => {
    const to = renames.get(tool.id);
    if (!to) return tool;
    renamed.push({ id: tool.id, from: tool.repo, to });
    return { ...tool, repo: to };
  });
  return { tools: out, renamed, removed };
}
