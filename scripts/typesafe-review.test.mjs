import { describe, expect, it } from 'vitest';
import { buildQuestions, buildState, diceSimilarity, shortlistCandidates } from './typesafe-review.mjs';

const existing = [
  { id: 'langchain', name: 'LangChain', org: 'LangChain Inc', tagline: 'Framework for LLM apps', desc: 'desc', repo: 'langchain-ai/langchain' },
  { id: 'llama-index', name: 'LlamaIndex', org: 'LlamaIndex', tagline: 'Data framework for LLMs', desc: 'desc', repo: 'run-llama/llama_index' },
  { id: 'whisper', name: 'Whisper', org: 'OpenAI', tagline: 'Speech recognition', desc: 'desc', repo: 'openai/whisper' },
];

const categories = [
  { id: 'agents', label: 'Agents & Automation', icon: 'bot', color: '#000000', blurb: 'Agent frameworks and automation.' },
  { id: 'speech', label: 'Speech & Voice', icon: 'mic', color: '#111111', blurb: 'Speech and voice models.' },
];

describe('diceSimilarity', () => {
  it('scores identical strings at 1', () => {
    expect(diceSimilarity('LangChain', 'LangChain')).toBe(1);
  });

  it('scores unrelated strings low', () => {
    expect(diceSimilarity('LangChain', 'Whisper')).toBeLessThan(0.2);
  });

  it('is case-insensitive and tolerant of punctuation', () => {
    expect(diceSimilarity('Lang-Chain', 'langchain')).toBeGreaterThan(0.8);
  });

  it('returns 0 for empty input', () => {
    expect(diceSimilarity('', 'LangChain')).toBe(0);
    expect(diceSimilarity(undefined, 'LangChain')).toBe(0);
  });
});

describe('shortlistCandidates', () => {
  it('ranks a near-duplicate name above unrelated tools', () => {
    const candidate = { id: 'new-1', name: 'Lang Chain', org: 'Someone', tagline: 't', desc: 'd' };
    const shortlist = shortlistCandidates(candidate, existing);
    expect(shortlist[0].id).toBe('langchain');
  });

  it('matches on identical repo even with a different name', () => {
    const candidate = { id: 'new-2', name: 'Totally Different Name', org: 'Someone', repo: 'OPENAI/WHISPER' };
    const shortlist = shortlistCandidates(candidate, existing);
    expect(shortlist[0].id).toBe('whisper');
  });

  it('excludes the candidate itself when it is already in the catalog', () => {
    const candidate = existing[0];
    const shortlist = shortlistCandidates(candidate, existing);
    expect(shortlist.find(tool => tool.id === candidate.id)).toBeUndefined();
  });

  it('returns nothing when no tool clears the similarity floor', () => {
    const candidate = { id: 'new-3', name: 'Xyzzy Quux Plover', org: 'Nobody' };
    expect(shortlistCandidates(candidate, existing)).toEqual([]);
  });

  it('respects a custom size limit', () => {
    const candidate = { id: 'new-4', name: 'Lang Chain', org: 'LlamaIndex', repo: 'openai/whisper' };
    expect(shortlistCandidates(candidate, existing, { size: 1 })).toHaveLength(1);
  });
});

describe('buildState', () => {
  it('keys the shortlist positionally and strips unused fields', () => {
    const candidate = { id: 'new-1', name: 'Lang Chain', org: 'Someone', tagline: 't', desc: 'd', repo: 'someone/lang-chain' };
    const state = buildState(candidate, [existing[0]]);
    expect(state.candidate).toEqual({ name: 'Lang Chain', org: 'Someone', tagline: 't', desc: 'd', repo: 'someone/lang-chain' });
    expect(Object.keys(state.shortlist)).toEqual(['existing_0']);
    expect(state.shortlist.existing_0.name).toBe('LangChain');
  });

  it('defaults a missing repo to null rather than omitting the field', () => {
    const candidate = { id: 'new-1', name: 'n', org: 'o', tagline: 't', desc: 'd' };
    const state = buildState(candidate, []);
    expect(state.candidate.repo).toBeNull();
  });
});

describe('buildQuestions', () => {
  it('emits one duplicate question per shortlisted tool, plus the fixed questions', () => {
    const questions = buildQuestions([existing[0], existing[1]], categories);
    expect(questions.duplicate_0.type).toBe('noul');
    expect(questions.duplicate_1.type).toBe('noul');
    expect(questions.duplicate_2).toBeUndefined();
    expect(questions.category.type).toBe('choice');
    expect(questions.license_conflict.type).toBe('noul');
    expect(questions.tagline_accurate.type).toBe('noul');
    expect(questions.status_plausible.type).toBe('score');
  });

  it('maps the category question criteria from the category list', () => {
    const questions = buildQuestions([], categories);
    expect(questions.category.criteria).toEqual({
      agents: 'Agent frameworks and automation.',
      speech: 'Speech and voice models.',
    });
  });
});
