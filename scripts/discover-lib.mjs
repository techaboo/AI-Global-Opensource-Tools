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

// Repos that are reading material or curation rather than software: awesome-lists, guides,
// courses, books, interview prep. Matched on name/topics (strong signals) and on the
// description (phrases that only describe non-software). CJK terms have no word boundaries.
const NON_SOFTWARE_NAME = /^awesome[-_]|(^|[-_])(guide|handbook|cheatsheet|cheat-sheet|roadmap|interview|interviews|tutorial|tutorials|course|courses|book|books|checklist|best[-_]practices?)([-_]|$)/i;
const NON_SOFTWARE_TOPICS = new Set([
  'awesome', 'awesome-list', 'awesome-lists', 'interview', 'interview-questions', 'interview-preparation',
  'tutorial', 'tutorials', 'course', 'courses', 'book', 'books', 'roadmap', 'cheatsheet', 'cheat-sheet',
  'handbook', 'guide', 'learning-resources', 'study-notes', 'free-programming-books', 'ebook',
]);
const NON_SOFTWARE_DESC = /^(an? )?(curated )?(list|collection) of\b|\bawesome[- ]list\b|\bcurated list\b|\b(interview|tutorials?|courses?|cheat ?sheets?|roadmap|handbook|textbook|ebook|study guide|checklist)\b|\bguide to\b|面试|教程|指南|电子书|全书/i;

// AI/ML relevance, matched on name + description + topics. Word-bounded so "ai" doesn't hit "email".
const AI_TERMS = /\b(ai|a\.i\.|llms?|gpt|genai|ml|machine[- ]learning|deep[- ]learning|neural|agents?|agentic|rag|mcp|model[- ]context[- ]protocol|diffusion|transformers?|embeddings?|nlp|computer[- ]vision|generative|inference|language[- ]models?|openai|anthropic|claude|copilot|speech|tts|asr|ocr|pytorch|tensorflow|vector[- ](database|search|store))\b|大模型|人工智能/i;

/**
 * Cheap, deterministic relevance gate run before any TypeSafe call.
 * Returns null when the repo is a plausible AI/ML software project, otherwise
 * 'non-software' (list/guide/course/book) or 'not-ai' (no AI/ML signal at all).
 */
export function classifyRepo(repo) {
  const name = repo.name ?? '';
  const desc = repo.description ?? '';
  const topics = repo.topics ?? [];
  if (NON_SOFTWARE_NAME.test(name) || topics.some(t => NON_SOFTWARE_TOPICS.has(t)) || NON_SOFTWARE_DESC.test(desc)) {
    return 'non-software';
  }
  if (!AI_TERMS.test(`${name} ${desc} ${topics.join(' ')}`)) return 'not-ai';
  return null;
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
