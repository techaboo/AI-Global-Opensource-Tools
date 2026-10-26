import { describe, expect, it } from 'vitest';
import type { AITool, Category } from '@/types';
import { DEFAULT_FILTERS, buildUrlQuery, filterTools, readUrlState, sortTools } from '@/lib/catalogView';
import { appendStarPoint, MAX_HISTORY_POINTS } from '@/lib/historyCore.js';

const tool = (over: Partial<AITool>): AITool => ({
  id: 'x', name: 'X', org: 'o', cat: 'agents', tagline: 't', desc: 'd', license: 'MIT', lang: 'Python',
  stars: 1, tags: ['a'], status: 'active', year: 2024, ...over,
} as AITool);
const cats = new Map<string, Category>([['agents', { id: 'agents', label: 'Agent Frameworks', icon: 'bot', color: '#000000', blurb: '' }]]);

describe('catalogView', () => {
  it('round-trips URL state and drops defaults', () => {
    const state = { ...DEFAULT_FILTERS, q: 'rag', cat: 'agents', sort: 'name' as const, view: 'compare' as const, cmp: ['agents', 'rag'] };
    const qs = buildUrlQuery(state);
    expect(readUrlState(qs)).toEqual({ q: 'rag', cat: 'agents', sort: 'name', view: 'compare', cmp: ['agents', 'rag'] });
    expect(buildUrlQuery({ ...DEFAULT_FILTERS, sort: 'stars', view: 'grid', cmp: [] })).toBe('');
  });

  it('rejects invalid sort/view values', () => {
    expect(readUrlState('sort=evil&view=nope')).toEqual({});
  });

  it('filters by category label text and ignores category for compare pool', () => {
    const tools = [tool({ id: 'a', cat: 'agents' }), tool({ id: 'b', cat: 'rag', name: 'Other' })];
    expect(filterTools(tools, { ...DEFAULT_FILTERS, q: 'agent frameworks' }, new Set(), cats).map(t => t.id)).toEqual(['a']);
    const f = { ...DEFAULT_FILTERS, cat: 'agents' };
    expect(filterTools(tools, f, new Set(), cats)).toHaveLength(1);
    expect(filterTools(tools, f, new Set(), cats, { ignoreCategory: true })).toHaveLength(2);
  });

  it('sorts by live stars when available', () => {
    const tools = [tool({ id: 'a', stars: 10 }), tool({ id: 'b', stars: 5 })];
    const live = { b: { stars: 99, forks: 0, openIssues: 0, pushedAt: '', fetchedAt: 1 } };
    expect(sortTools(tools, 'stars', live).map(t => t.id)).toEqual(['b', 'a']);
  });
});

describe('historyCore (shared with CI)', () => {
  it('replaces same-day points, drops invalid ones, caps length', () => {
    const day = 86_400_000;
    let h = appendStarPoint([{ t: 1.5, s: 1 } as never], 1, day);
    expect(h).toEqual([{ t: day, s: 1 }]);
    h = appendStarPoint(h, 2, day + 1000);
    expect(h).toEqual([{ t: day + 1000, s: 2 }]);
    for (let i = 2; i < 100; i += 1) h = appendStarPoint(h, i, i * day);
    expect(h).toHaveLength(MAX_HISTORY_POINTS);
  });
});
