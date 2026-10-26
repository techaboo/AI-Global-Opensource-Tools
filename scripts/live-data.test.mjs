import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT } from './catalog.mjs';

// End-to-end through real git: push from one clone, pull into another.
// Regression: execFileSync's default 1 MB maxBuffer truncated the multi-MB
// snapshot on pull, the error was swallowed, and every repo's history reset.
const SCRIPT = join(ROOT, 'scripts/live-data.mjs');
const base = mkdtempSync(join(tmpdir(), 'live-data-test-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const sh = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const run = (cwd, ...args) => execFileSync(process.execPath, [SCRIPT, ...args], {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LIVE_DATA_ROOT: cwd },
});

function clone(name) {
  const dir = join(base, name);
  sh(base, ['clone', '-q', join(base, 'remote.git'), dir]);
  sh(dir, ['config', 'user.email', 't@t']);
  sh(dir, ['config', 'user.name', 't']);
  return dir;
}

describe('live-data push/pull', () => {
  it('round-trips a >1 MB snapshot intact and is idempotent', () => {
    sh(base, ['init', '-q', '--bare', '-b', 'main', 'remote.git']);
    const seed = join(base, 'seed');
    mkdirSync(seed);
    sh(seed, ['init', '-q', '-b', 'main']);
    sh(seed, ['config', 'user.email', 't@t']);
    sh(seed, ['config', 'user.name', 't']);
    writeFileSync(join(seed, 'README'), 'x');
    sh(seed, ['add', '.']);
    sh(seed, ['commit', '-q', '-m', 'init']);
    sh(seed, ['push', '-q', join(base, 'remote.git'), 'main']);

    const writer = clone('writer');
    const snapshot = JSON.stringify({ generatedAt: 'x', repos: { a: { pad: 'y'.repeat(3 * 1024 * 1024) } } });
    mkdirSync(join(writer, 'public'));
    writeFileSync(join(writer, 'public/live-snapshot.json'), snapshot);
    expect(run(writer, 'push', 'test')).toMatch(/Pushed 1 file/);
    expect(run(writer, 'push', 'test')).toMatch(/unchanged/);

    const reader = clone('reader');
    expect(run(reader, 'pull')).toMatch(/live-snapshot\.json/);
    expect(readFileSync(join(reader, 'public/live-snapshot.json'), 'utf8')).toBe(snapshot);
  });
});
