import { describe, expect, it } from 'vitest';
import { buildSearchPlan, classifyRepo, isRejectActive, pruneRejects, recordReject, sortByStarsDesc } from './discover-lib.mjs';

const NOW = Date.parse('2026-10-26T12:00:00Z');

describe('buildSearchPlan', () => {
  it('emits a created-window and a pushed-window query per topic', () => {
    const plan = buildSearchPlan(['topic:llm'], NOW);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ window: 'new', pages: 2 });
    expect(plan[0].q).toContain('created:>2026-07-28');
    expect(plan[0].q).toContain('stars:>100');
    expect(plan[1]).toMatchObject({ window: 'established', pages: 3 });
    expect(plan[1].q).toContain('pushed:>2026-09-26');
    expect(plan[1].q).toContain('stars:>300');
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
