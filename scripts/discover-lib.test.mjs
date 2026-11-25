import { describe, expect, it } from 'vitest';
import {
  CATEGORY_TOPICS, buildSearchPlan, categoriesByNeed, classifyRepo, interleaveByCategory, isRejectActive, pruneRejects,
  recordReject, sortByStarsDesc,
} from './discover-lib.mjs';
import { SEARCH_TIERS, backfill } from './discover-lib.mjs';
import catalog from '../src/data/catalog.json';

const NOW = Date.parse('2026-10-26T12:00:00Z');

describe('buildSearchPlan', () => {
  it('emits a created-window and a pushed-window query per topic', () => {
    const plan = buildSearchPlan(['topic:llm'], NOW);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ window: 'new', pages: 1 });
    expect(plan[0].q).toContain('created:>2026-07-28');
    expect(plan[0].q).toContain('stars:>100');
    expect(plan[1]).toMatchObject({ window: 'established', pages: 2 });
    expect(plan[1].q).toContain('pushed:>2026-09-26');
    expect(plan[1].q).toContain('stars:>300');
  });
});

describe('category coverage', () => {
  it('has search topics for every catalog category', () => {
    expect(Object.keys(CATEGORY_TOPICS).sort()).toEqual(catalog.categories.map(c => c.id).sort());
  });

  it('orders categories thinnest first', () => {
    const categories = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(categoriesByNeed(categories, [{ cat: 'a' }, { cat: 'a' }, { cat: 'c' }])).toEqual(['b', 'c', 'a']);
  });

  it('takes one candidate per category per round', () => {
    const queues = new Map([['a', ['a1', 'a2', 'a3']], ['b', ['b1']]]);
    expect(interleaveByCategory(queues, ['b', 'c', 'a'])).toEqual(['b1', 'a1', 'a2', 'a3']);
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

describe('classifyRepo', () => {
  const repo = (name, description, topics = []) => ({ name, description, topics });

  it('accepts real AI/ML software', () => {
    expect(classifyRepo(repo('rtk', 'CLI proxy that reduces LLM token consumption by 60-90%', ['ai-coding']))).toBeNull();
    expect(classifyRepo(repo('MOVA', 'A foundation model that generates synchronized video and audio', ['diffusion-models']))).toBeNull();
    expect(classifyRepo(repo('compromise', 'modest natural-language processing', ['nlp']))).toBeNull();
    expect(classifyRepo(repo('whisper', 'Robust speech recognition via large-scale weak supervision'))).toBeNull();
  });

  it('rejects interview guides even when they mention AI', () => {
    expect(classifyRepo(repo('JavaGuide', 'Java 面试 & 后端通用面试指南，覆盖 AI 应用开发', ['ai', 'agent', 'interview']))).toBe('non-software');
  });

  it('rejects awesome-lists, books, courses and best-practice collections', () => {
    expect(classifyRepo(repo('awesome-copilot', 'Community-contributed instructions for GitHub Copilot'))).toBe('non-software');
    expect(classifyRepo(repo('ai-agent-book', 'Open-source repository of the book on AI agents', ['ai-agent', 'book']))).toBe('non-software');
    expect(classifyRepo(repo('claude-code-best-practice', 'from vibe coding to agentic engineering', ['ai']))).toBe('non-software');
    expect(classifyRepo(repo('llm-course', 'Course to get into Large Language Models (LLMs) with roadmaps'))).toBe('non-software');
    expect(classifyRepo(repo('ai-resources', 'A curated list of AI papers', ['ai']))).toBe('non-software');
  });

  it('rejects repos with no AI/ML signal at all', () => {
    expect(classifyRepo(repo('Front-End-Checklist', 'The perfect front-end checklist for modern websites'))).toBe('non-software');
    expect(classifyRepo(repo('some-db', 'A fast key-value store written in Rust', ['database']))).toBe('not-ai');
  });

  it('does not match "ai" inside other words', () => {
    expect(classifyRepo(repo('mailer', 'Send email with retries', ['email']))).toBe('not-ai');
  });
});

describe('daily minimum', () => {
  it('widens each search tier without dropping the earlier ground', () => {
    const floors = SEARCH_TIERS.map(tier => {
      const [fresh, established] = buildSearchPlan(['topic:rag'], Date.UTC(2026, 10, 25), tier);
      return [Number(fresh.q.match(/stars:>(\d+)/)[1]), established.pages];
    });
    expect(floors).toEqual([[100, 2], [50, 4], [25, 7]]);
  });

  it('backfills by raising the category cap one step at a time', () => {
    const deferred = ['a', 'a', 'a', 'b'].map((cat, i) => ({ cat, i }));
    const picked = backfill(deferred, new Map([['a', 2], ['b', 2]]), 2, 3);
    expect(picked.map(c => c.i)).toEqual([0, 3, 1]);
  });

  it('adds nothing when the minimum is already met', () => {
    expect(backfill([{ cat: 'a' }], new Map(), 2, 0)).toEqual([]);
  });
});
