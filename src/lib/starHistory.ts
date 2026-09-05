import type { AITool, LiveRepoData, StarPoint } from '@/types';

export const MAX_HISTORY_POINTS = 52;

function sameUtcDay(a: number, b: number): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

/** Append or update today's sample, keeping at most MAX_HISTORY_POINTS. */
export function appendStarPoint(history: StarPoint[] | undefined, stars: number, at = Date.now()): StarPoint[] {
  const pts = [...(history ?? [])].sort((a, b) => a.t - b.t);
  const last = pts[pts.length - 1];
  if (last && sameUtcDay(last.t, at)) {
    pts[pts.length - 1] = { t: at, s: stars };
  } else {
    pts.push({ t: at, s: stars });
  }
  return pts.slice(-MAX_HISTORY_POINTS);
}

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
