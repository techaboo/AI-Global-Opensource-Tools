// Shared by the browser (src/lib/starHistory.ts) and CI (scripts/fetch-stars.mjs)
// so the snapshot and in-app history can never disagree on shape or limits.
// Plain JS with a .d.ts so Node runs it without a TypeScript step.

export const MAX_HISTORY_POINTS = 52;

function sameUtcDay(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

/** Append or replace today's sample (integer t/s only, chronological), keeping at most MAX_HISTORY_POINTS. */
export function appendStarPoint(history, stars, at = Date.now()) {
  const pts = (Array.isArray(history) ? history : [])
    .filter(p => p && Number.isSafeInteger(p.t) && Number.isSafeInteger(p.s))
    .sort((a, b) => a.t - b.t);
  const last = pts[pts.length - 1];
  if (last && sameUtcDay(last.t, at)) pts[pts.length - 1] = { t: at, s: stars };
  else pts.push({ t: at, s: stars });
  return pts.slice(-MAX_HISTORY_POINTS);
}
