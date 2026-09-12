import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/tools';
import { MAX_COMPARE, dedupeIds, defaultCompareIds, parseCompareIds } from '@/lib/compare';

describe('category comparison state', () => {
  it('creates default IDs that exist in the category catalog', () => {
    const ids = defaultCompareIds(CATEGORIES[0].id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.every(id => CATEGORIES.some(category => category.id === id))).toBe(true);
  });

  it('deduplicates IDs while preserving their order', () => {
    expect(dedupeIds(['agents', 'rag', 'agents'])).toEqual(['agents', 'rag']);
  });

  it('accepts only valid categories and enforces the comparison limit', () => {
    const valid = CATEGORIES.slice(0, MAX_COMPARE + 1).map(category => category.id);
    const parsed = parseCompareIds(`${valid.join(',')},invalid,${valid[0]}`);
    expect(parsed).toEqual(valid.slice(0, MAX_COMPARE));
  });

  it('returns an empty selection when no URL value exists', () => {
    expect(parseCompareIds(null)).toEqual([]);
  });
});
