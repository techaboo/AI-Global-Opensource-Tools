import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRepoFacts, limitWaitMs } from './github.mjs';

const headers = values => new Headers(values);
const node = { nameWithOwner: 'o/a', isArchived: false, isDisabled: false, stargazerCount: 1, forkCount: 0, pushedAt: '2026-01-01T00:00:00Z', issues: { totalCount: 1 }, pullRequests: { totalCount: 2 } };
const reply = body => ({ ok: true, status: 200, json: async () => body });
const options = { token: 't', retryDelayMs: 0, paceMs: 0 };

afterEach(() => vi.unstubAllGlobals());

describe('limitWaitMs', () => {
  it('waits out a burst limit but not an exhausted hourly quota', () => {
    expect(limitWaitMs(headers({ 'retry-after': '30' }))).toBe(30_000);
    expect(limitWaitMs(headers({}))).toBe(60_000);
    expect(limitWaitMs(headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '4000' }), 0)).toBeNull();
  });
});

describe('fetchRepoFacts', () => {
  it('tells a missing repository apart from one GitHub would not answer for', async () => {
    vi.stubGlobal('fetch', async () => reply({
      data: { r0: node, r1: null, r2: null },
      errors: [{ type: 'NOT_FOUND', path: ['r1'] }, { type: 'FORBIDDEN', path: ['r2'], message: 'blocked' }],
    }));
    const facts = await fetchRepoFacts(['o/a', 'o/b', 'o/c'], options);
    expect(facts.get('o/a')).toMatchObject({ status: 'ok', openIssues: 3 });
    expect(facts.get('o/b')).toEqual({ status: 'missing' });
    expect(facts.get('o/c')).toEqual({ status: 'error', message: 'blocked' });
  });

  it('retries a repository that failed on its own', async () => {
    const answers = [{ data: { r0: null }, errors: [{ path: ['r0'], message: 'timeout' }] }, { data: { r0: node } }];
    vi.stubGlobal('fetch', async () => reply(answers.shift()));
    expect((await fetchRepoFacts(['o/a'], options)).get('o/a').status).toBe('ok');
  });

  it('reports errors, never "missing", when the service is down', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 502 }));
    expect((await fetchRepoFacts(['o/a'], { ...options, retries: 1 })).get('o/a').status).toBe('error');
  });

  it('refuses to run without a token', async () => {
    await expect(fetchRepoFacts(['o/a'], {})).rejects.toThrow(/GITHUB_TOKEN/);
  });
});
