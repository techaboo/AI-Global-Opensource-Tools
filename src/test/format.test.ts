import { describe, expect, it } from 'vitest';
import { isStale } from '@/lib/format';

describe('isStale', () => {
  it('is false when there is no pushedAt (missing data is not evidence of staleness)', () => {
    expect(isStale(undefined)).toBe(false);
  });

  it('is false for an unparseable date rather than throwing', () => {
    expect(isStale('not-a-date')).toBe(false);
  });

  it('is false for a recent push', () => {
    expect(isStale(new Date().toISOString())).toBe(false);
  });

  it('is true for a push older than the default 365-day window', () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    expect(isStale(old)).toBe(true);
  });

  it('respects a custom day threshold', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(isStale(tenDaysAgo, 5)).toBe(true);
    expect(isStale(tenDaysAgo, 30)).toBe(false);
  });
});
