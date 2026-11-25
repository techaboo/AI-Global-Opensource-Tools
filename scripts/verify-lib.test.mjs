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

  it('never passes a new entry it could not check', () => {
    expect(assessCatalog([tool('a', 'o/a')], new Map(), new Set()).failures).toHaveLength(1);
  });

  it('reports a few unanswered older entries without blocking publication', () => {
    const result = assessCatalog([tool('a', 'o/a')], new Map(), new Set(['a']));
    expect(result.unchecked).toHaveLength(1);
    expect(result.failures).toEqual([]);
    expect(renderVerification(result)).toContain('Could not be verified');
  });

  it('fails when too many entries cannot be checked', () => {
    const many = Array.from({ length: 4 }, (_, i) => tool(`t${i}`, `o/t${i}`));
    expect(assessCatalog(many, new Map(), new Set(many.map(t => t.id))).failures).toHaveLength(4);
  });
});
