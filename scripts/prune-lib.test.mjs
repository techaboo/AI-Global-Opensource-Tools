import { describe, expect, it } from 'vitest';
import { isRevived, selectStale } from './prune-lib.mjs';

const NOW = Date.parse('2026-11-25T00:00:00Z');
const tool = (id, extra = {}) => ({ id, repo: `o/${id}`, cat: 'agents', status: 'active', ...extra });
const snapshot = dates => ({ repos: Object.fromEntries(Object.entries(dates).map(([id, pushedAt]) => [id, { pushedAt }])) });

describe('isRevived', () => {
  it('only revives unarchived repos with a recent push', () => {
    expect(isRevived({ archived: false, pushed_at: '2026-11-20T00:00:00Z' }, NOW)).toBe(true);
    expect(isRevived({ archived: true, pushed_at: '2026-11-20T00:00:00Z' }, NOW)).toBe(false);
    expect(isRevived({ archived: false, pushed_at: '2025-01-01T00:00:00Z' }, NOW)).toBe(false);
  });
});

describe('selectStale', () => {
  it('removes repos idle for over 18 months, longest idle first', () => {
    const result = selectStale(
      [tool('newer'), tool('old'), tool('ancient'), tool('edge')],
      snapshot({ newer: '2026-09-01T00:00:00Z', old: '2025-01-01T00:00:00Z', ancient: '2023-01-01T00:00:00Z', edge: '2025-05-26T00:00:00Z' }),
      NOW,
    );
    expect(result.map(r => r.id)).toEqual(['ancient', 'old']);
  });

  it('removes archived tools in every category, ahead of idle ones', () => {
    const result = selectStale(
      [tool('idle'), tool('dead', { cat: 'models', status: 'archived' })],
      snapshot({ idle: '2023-01-01T00:00:00Z' }),
      NOW,
    );
    expect(result.map(r => r.id)).toEqual(['dead', 'idle']);
  });

  it('keeps idle foundation models and tools with no snapshot data', () => {
    const result = selectStale(
      [tool('weights', { cat: 'models' }), tool('unknown')],
      snapshot({ weights: '2023-01-01T00:00:00Z' }),
      NOW,
    );
    expect(result).toEqual([]);
  });
});
