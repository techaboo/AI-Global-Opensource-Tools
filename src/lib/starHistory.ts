import type { AITool, LiveRepoData, StarPoint } from '@/types';

// Single implementation shared with scripts/fetch-stars.mjs.
export { MAX_HISTORY_POINTS, appendStarPoint } from './historyCore.js';

function approximateHistory(tool: AITool, currentStars: number): StarPoint[] {
  const start = Date.UTC(tool.year, 0, 15);
  const end = Date.now();
  const n = 12;
  const span = Math.max(end - start, 1);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    // Typical OSS growth: slow start, then accelerating (not linear).
    const eased = Math.pow(t, 1.45);
    return { t: start + span * t, s: Math.max(0, Math.round(currentStars * eased)) };
  });
}

export type HistorySource = 'live' | 'approx';

/**
 * Prefer accumulated snapshot/sync samples. If we have fewer than 2 real points,
 * fall back to a lightweight year→now curve so sparklines still render offline.
 */
export function resolveStarHistory(tool: AITool, live?: LiveRepoData): { points: StarPoint[]; source: HistorySource } {
  const stars = live?.stars ?? tool.stars;
  const real = (live?.history ?? []).filter(p => Number.isFinite(p.t) && Number.isFinite(p.s));
  if (real.length >= 2) return { points: real, source: 'live' };
  const approx = approximateHistory(tool, stars);
  if (real.length === 1) {
    return { points: [...approx.slice(0, -1), real[0]], source: 'approx' };
  }
  return { points: approx, source: 'approx' };
}
