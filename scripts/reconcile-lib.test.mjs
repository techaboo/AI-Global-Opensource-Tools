import { describe, expect, it } from 'vitest';
import { reconcileRepos } from './reconcile-lib.mjs';

const tool = (id, repo) => ({ id, repo });
const ok = nameWithOwner => ({ status: 'ok', nameWithOwner });

describe('reconcileRepos', () => {
  it('moves a renamed repo to its canonical name', () => {
    const result = reconcileRepos([tool('a', 'old/a')], new Map([['old/a', ok('new/a')]]));
    expect(result.tools).toEqual([tool('a', 'new/a')]);
    expect(result.renamed).toEqual([{ id: 'a', from: 'old/a', to: 'new/a' }]);
  });

  it('keeps the entry already on the canonical name when two resolve to one repo', () => {
    const facts = new Map([['x/old', ok('x/new')], ['x/new', ok('x/new')]]);
    const result = reconcileRepos([tool('old', 'x/old'), tool('new', 'x/new')], facts);
    expect(result.tools.map(t => t.id)).toEqual(['new']);
    expect(result.removed).toEqual([expect.objectContaining({ id: 'old', keptId: 'new' })]);
  });

  it('does not create a duplicate when the canonical entry could not be checked', () => {
    const facts = new Map([['x/old', ok('x/new')], ['x/new', { status: 'error' }]]);
    const result = reconcileRepos([tool('old', 'x/old'), tool('new', 'x/new')], facts);
    expect(result.tools).toEqual([tool('new', 'x/new')]);
  });

  it('ignores case-only differences and unchecked repos', () => {
    const facts = new Map([['A/b', ok('a/B')], ['c/d', { status: 'missing' }]]);
    const tools = [tool('b', 'A/b'), tool('d', 'c/d')];
    expect(reconcileRepos(tools, facts)).toEqual({ tools, renamed: [], removed: [] });
  });

  it('removes an entry renamed onto an excluded repo', () => {
    const result = reconcileRepos([tool('a', 'old/a')], new Map([['old/a', ok('Bad/a')]]), new Map([['bad/a', 'spam']]));
    expect(result.tools).toEqual([]);
    expect(result.removed).toHaveLength(1);
  });
});
