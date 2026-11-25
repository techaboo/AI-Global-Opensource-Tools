import { describe, expect, it } from 'vitest';
import { assessCatalog, renderVerification } from './verify-lib.mjs';

const tool = (id, repo, status = 'active') => ({ id, repo, status });
const ok = (nameWithOwner, archived = false) => ({ status: 'ok', nameWithOwner, archived });

describe('assessCatalog', () => {
  it('passes a clean catalog', () => {
    const result = assessCatalog([tool('a', 'o/a')], new Map([['o/a', ok('o/a')]]));
    expect(result.failures).toEqual([]);
    expect(renderVerification(result)).toContain('PASS');
  });

  it('fails when two entries are one repository', () => {
    const facts = new Map([['o/old', ok('o/new')], ['o/new', ok('o/new')]]);
    expect(assessCatalog([tool('a', 'o/old'), tool('b', 'o/new')], facts).failures).toHaveLength(1);
  });

  it('fails a dead new entry but only reports a dead older one', () => {
    const facts = new Map([['o/a', { status: 'missing' }], ['o/b', { status: 'missing' }]]);
    const result = assessCatalog([tool('a', 'o/a'), tool('b', 'o/b')], facts, new Set(['a']));
    expect(result.dead).toHaveLength(2);
    expect(result.failures).toEqual(['new entry b points to a missing repository o/b']);
  });

  it('treats an unanswered lookup as unverified, never as passing', () => {
    expect(assessCatalog([tool('a', 'o/a')], new Map()).failures).toHaveLength(1);
  });
});
