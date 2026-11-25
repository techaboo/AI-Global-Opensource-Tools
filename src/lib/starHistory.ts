import type { LiveRepoData, StarPoint } from '@/types';

// Single implementation shared with scripts/fetch-stars.mjs.
export { MAX_HISTORY_POINTS, appendStarPoint } from './historyCore.js';

export type HistorySource = 'live' | 'collecting';

/**
 * Only observed samples are ever drawn. With fewer than two there is no trend
 * yet, so nothing is plotted rather than an invented curve.
 */
export function resolveStarHistory(live?: LiveRepoData): { points: StarPoint[]; source: HistorySource } {
  const points = (live?.history ?? []).filter(p => Number.isFinite(p.t) && Number.isFinite(p.s));
  return { points, source: points.length >= 2 ? 'live' : 'collecting' };
}
