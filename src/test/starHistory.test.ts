import { describe, expect, it } from 'vitest';
import { appendStarPoint, MAX_HISTORY_POINTS, resolveStarHistory } from '@/lib/starHistory';

const day = Date.UTC(2026, 8, 11, 10);

describe('star history', () => {
  it('replaces a sample on the same UTC day', () => {
    const result = appendStarPoint([{ t: day, s: 10 }], 12, day + 60_000);
    expect(result).toEqual([{ t: day + 60_000, s: 12 }]);
  });

  it('caps accumulated history', () => {
    const points = Array.from({ length: MAX_HISTORY_POINTS + 5 }, (_, i) => ({
      t: day + i * 86_400_000,
      s: i,
    }));
    expect(appendStarPoint(points, 999, day + points.length * 86_400_000)).toHaveLength(MAX_HISTORY_POINTS);
  });

  it('prefers two or more real history points', () => {
    const points = [{ t: day, s: 10 }, { t: day + 86_400_000, s: 20 }];
    const live = {
      stars: 20,
      forks: 2,
      openIssues: 1,
      pushedAt: new Date(day).toISOString(),
      fetchedAt: day,
      history: points,
    };
    expect(resolveStarHistory(live).source).toBe('live');
  });

  it('draws nothing it has not observed', () => {
    expect(resolveStarHistory()).toEqual({ points: [], source: 'collecting' });
    const one = { stars: 1, forks: 0, openIssues: 0, pushedAt: '', fetchedAt: day, history: [{ t: day, s: 1 }] };
    expect(resolveStarHistory(one)).toEqual({ points: one.history, source: 'collecting' });
  });
});
