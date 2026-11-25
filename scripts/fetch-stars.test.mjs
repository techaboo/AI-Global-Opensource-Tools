import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROOT } from './catalog.mjs';

// Runs the real script against a throwaway copy of the repo with a faked GitHub.
const DAY_MS = 86_400_000;
const GONE = 'acme/gone';
let dir;

const tool = (id, repo) => ({
  id, name: id, org: 'acme', cat: 'agents', tagline: 't', desc: 'd', license: 'MIT', lang: 'Python',
  stars: 1, repo, tags: ['ai'], status: 'active', year: 2025,
});

const FAKE_GITHUB = `
globalThis.fetch = async url => {
  if (process.env.GONE_STATUS === '404' && String(url).endsWith('/${GONE}')) return { ok: false, status: 404, headers: new Headers() };
  return { ok: true, status: 200, headers: new Headers(), json: async () => ({
    stargazers_count: 5, forks_count: 1, open_issues_count: 0, archived: false, pushed_at: new Date().toISOString(),
  }) };
};
`;

const read = path => JSON.parse(readFileSync(join(dir, path), 'utf8'));
const statusOf = id => read('src/data/catalog.json').tools.find(t => t.id === id).status;

function refresh(goneStatus) {
  execFileSync(process.execPath, ['--import', pathToFileURL(join(dir, 'fake-github.mjs')).href, 'scripts/fetch-stars.mjs', '--update'], {
    cwd: dir, env: { ...process.env, GONE_STATUS: goneStatus, GITHUB_TOKEN: '' }, stdio: 'pipe',
  });
}

/** Rewrites the recorded first-404 time, standing in for days passing between runs. */
function ageMissing(days) {
  const snapshot = read('public/live-snapshot.json');
  snapshot.missing = { gone: new Date(Date.now() - days * DAY_MS).toISOString() };
  writeFileSync(join(dir, 'public/live-snapshot.json'), JSON.stringify(snapshot));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fetch-stars-'));
  for (const path of ['scripts', 'src/lib', 'src/data', 'public']) mkdirSync(join(dir, path), { recursive: true });
  for (const file of ['scripts/fetch-stars.mjs', 'scripts/catalog.mjs', 'scripts/prune-lib.mjs', 'src/lib/historyCore.js']) {
    cpSync(join(ROOT, file), join(dir, file));
  }
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  writeFileSync(join(dir, 'fake-github.mjs'), FAKE_GITHUB);
  writeFileSync(join(dir, 'src/data/catalog.json'), JSON.stringify({
    snapshotDate: 'September 2026',
    categories: [{ id: 'agents', label: 'Agents', icon: 'bot', color: '#000000', blurb: 'b' }],
    tools: [tool('gone', GONE), tool('here', 'acme/here')],
  }));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('fetch-stars 404 handling', () => {
  it('does not archive a tool after a single 404', () => {
    refresh('404');
    expect(statusOf('gone')).toBe('active');
  });

  it('archives a tool whose repo has been missing for 7 days', () => {
    refresh('404');
    ageMissing(8);
    refresh('404');
    expect(statusOf('gone')).toBe('archived');
  });

  it('restarts the count once the repo answers again', () => {
    refresh('404');
    ageMissing(8);
    refresh('200');
    refresh('404');
    expect(statusOf('gone')).toBe('active');
  });
});
