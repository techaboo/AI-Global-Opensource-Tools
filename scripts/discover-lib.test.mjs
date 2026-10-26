import { describe, expect, it } from 'vitest';
import { buildSearchPlan, isRejectActive, pruneRejects, recordReject, sortByStarsDesc } from './discover-lib.mjs';

const NOW = Date.parse('2026-10-26T12:00:00Z');

describe('buildSearchPlan', () => {
  it('emits a created-window and a pushed-window query per topic', () => {
    const plan = buildSearchPlan(['topic:llm'], NOW);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ window: 'new', pages: 2 });
    expect(plan[0].q).toContain('created:>2026-07-28');
    expect(plan[0].q).toContain('stars:>100');
    expect(plan[1]).toMatchObject({ window: 'established', pages: 3 });
    expect(plan[1].q).toContain('pushed:>2026-09-26');
    expect(plan[1].q).toContain('stars:>300');
  });
});

describe('reject memory', () => {
  it('is active until retryAfter and expires afterwards', () => {
    const rejects = {};
    recordReject(rejects, 'Acme/Widget', { kind: 'category', reason: 'low', score: 0.5512, stars: 420 }, NOW);
    const entry = rejects['acme/widget'];
    expect(entry.retryAfter).toBe('2026-11-09');
    expect(entry.score).toBe(0.55);
    expect(isRejectActive(entry, NOW)).toBe(true);
    expect(isRejectActive(entry, NOW + 15 * 86_400_000)).toBe(false);
  });

  it('retries duplicates less often than category rejects', () => {
    const rejects = {};
    recordReject(rejects, 'a/b', { kind: 'duplicate', reason: 'dup', stars: 1 }, NOW);
    expect(rejects['a/b'].retryAfter).toBe('2026-11-25');
  });

  it('treats a missing or malformed entry as not rejected', () => {
    expect(isRejectActive(undefined, NOW)).toBe(false);
    expect(isRejectActive({}, NOW)).toBe(false);
  });

  it('prunes entries long past their retry date', () => {
    const rejects = { old: { retryAfter: '2026-01-01' }, fresh: { retryAfter: '2026-11-01' } };
    expect(Object.keys(pruneRejects(rejects, NOW))).toEqual(['fresh']);
  });
});

describe('sortByStarsDesc', () => {
  it('orders by stars descending with a stable name tiebreak', () => {
    const repos = [
      { full_name: 'b/x', stargazers_count: 10 },
      { full_name: 'a/x', stargazers_count: 10 },
      { full_name: 'c/x', stargazers_count: 50 },
    ];
    expect(sortByStarsDesc(repos).map(r => r.full_name)).toEqual(['c/x', 'a/x', 'b/x']);
  });
});
