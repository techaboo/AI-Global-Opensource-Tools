/**
 * Pure helpers for scripts/discover-tools.mjs — kept side-effect free so the
 * search windows and the reject memory can be unit tested without the network.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const DAY_MS = 86_400_000;

/** Days before a rejected repo is looked at again, by rejection kind. */
export const RETRY_DAYS = { category: 14, duplicate: 30, name: 30 };

export const REJECTS_PATH_DEFAULT = new URL('../audits/discover-rejects.json', import.meta.url);

function isoDay(now, daysAgo) {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Search plan per topic. Two windows, both sorted by stars desc (the catalog's
 * ordering rule is preserved — it just applies within each window):
 *  - "new":  created recently, lower star floor — finds fresh projects that the
 *            established-by-stars window can never surface.
 *  - "established": recently pushed, higher floor — paged deeper than the old
 *            top-20-only query, which was saturated by already-cataloged giants.
 */
export function buildSearchPlan(topics, now = Date.now(), opts = {}) {
  const {
    newDays = 90, newMinStars = 100, newPages = 2,
    pushedDays = 30, minStars = 300, pushedPages = 3,
  } = opts;
  const plan = [];
  for (const topic of topics) {
    plan.push({
      window: 'new', topic, pages: newPages,
      q: `${topic} stars:>${newMinStars} created:>${isoDay(now, newDays)} fork:false archived:false`,
    });
    plan.push({
      window: 'established', topic, pages: pushedPages,
      q: `${topic} stars:>${minStars} pushed:>${isoDay(now, pushedDays)} fork:false archived:false`,
    });
  }
  return plan;
}

export function readRejects(path = REJECTS_PATH_DEFAULT) {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {}; // a corrupt memory file must never block discovery; it is rebuilt as runs reject repos
  }
}

export function writeRejects(rejects, path = REJECTS_PATH_DEFAULT) {
  const sorted = Object.fromEntries(Object.entries(rejects).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** True while a repo's rejection is still fresh enough that it shouldn't be re-reviewed. */
export function isRejectActive(entry, now = Date.now()) {
  if (!entry?.retryAfter) return false;
  return Date.parse(entry.retryAfter) > now;
}

export function recordReject(rejects, fullName, { kind, reason, score, stars }, now = Date.now()) {
  const days = RETRY_DAYS[kind] ?? RETRY_DAYS.category;
  rejects[fullName.toLowerCase()] = {
    kind,
    reason,
    ...(typeof score === 'number' ? { score: Number(score.toFixed(2)) } : {}),
    stars,
    rejectedAt: new Date(now).toISOString().slice(0, 10),
    retryAfter: new Date(now + days * DAY_MS).toISOString().slice(0, 10),
  };
}

/** Stars desc, then name, so selection and insertion order is deterministic and unbiased by search order. */
export function sortByStarsDesc(repos) {
  return [...repos].sort((a, b) => (b.stargazers_count - a.stargazers_count) || a.full_name.localeCompare(b.full_name));
}

/** Drop long-expired entries so the memory file doesn't grow without bound. */
export function pruneRejects(rejects, now = Date.now(), graceDays = 60) {
  const out = {};
  for (const [key, entry] of Object.entries(rejects)) {
    if (Date.parse(entry?.retryAfter) + graceDays * DAY_MS > now) out[key] = entry;
  }
  return out;
}
