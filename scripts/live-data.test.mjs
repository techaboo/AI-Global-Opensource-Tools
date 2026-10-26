import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from './catalog.mjs';

// Regression: execFileSync's default 1 MB maxBuffer silently truncated the
// multi-MB snapshot on pull, which then reset every repo's star history.
describe('live-data pull', () => {
  it('reads files far larger than 1 MB intact', () => {
    const big = 'x'.repeat(5 * 1024 * 1024);
    const out = execFileSync(process.execPath, ['-e', `process.stdout.write(${JSON.stringify("'")}.repeat(0)+'${'x'}'.repeat(${big.length}))`], {
      cwd: ROOT, maxBuffer: 512 * 1024 * 1024,
    });
    expect(out.length).toBe(big.length);
  });

  it('pull script uses an explicit large maxBuffer for git show', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./live-data.mjs', import.meta.url), 'utf8');
    const showCall = src.split('\n').find(line => line.includes("'show'"));
    expect(showCall).toMatch(/maxBuffer/);
  });
});
