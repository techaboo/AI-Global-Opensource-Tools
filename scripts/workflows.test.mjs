import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { ROOT } from './catalog.mjs';

// A workflow file that fails to parse silently disables a scheduled bot
// (GitHub just records a "workflow file issue"), so parse every one in CI.
const dir = join(ROOT, '.github/workflows');

describe('GitHub workflow files', () => {
  it('publishes the stats snapshot even when some repos failed to refresh', () => {
    const wf = parseDocument(readFileSync(join(dir, 'refresh-stars.yml'), 'utf8')).toJS();
    const publish = wf.jobs.refresh.steps.find(s => s.name === 'Publish snapshot to live-data');
    // fetch-stars exits 1 after writing a partial snapshot, which holds the 404 history.
    expect(publish.if).toBe("${{ !cancelled() && steps.fetch.conclusion != 'skipped' }}");
  });

  it('pins every action to a commit SHA', () => {
    for (const file of readdirSync(dir)) {
      for (const [, ref] of readFileSync(join(dir, file), 'utf8').matchAll(/uses:\s*(\S+)/g)) expect(ref, file).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it('never interpolates untrusted input into a shell script', () => {
    for (const file of readdirSync(dir)) {
      const wf = parseDocument(readFileSync(join(dir, file), 'utf8')).toJS();
      for (const job of Object.values(wf.jobs)) {
        for (const step of job.steps ?? []) expect(step.run ?? '', file).not.toMatch(/\$\{\{\s*(inputs|github\.event)\./);
      }
    }
  });

  it('runs the daily pipeline in order: pull, re-check, prune, discover, verify, publish', () => {
    const wf = parseDocument(readFileSync(join(dir, 'discover-tools.yml'), 'utf8')).toJS();
    const runs = wf.jobs.pipeline.steps.map(s => s.run ?? '').join('\n');
    const order = ['live-data.mjs pull', 'fetch-stars.mjs --update', 'prune-stale.mjs', 'discover-tools.mjs', 'verify-catalog.mjs', 'open-bot-pr.sh', 'api/v1/meta.json'];
    const at = order.map(marker => runs.indexOf(marker));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at[0]).toBeGreaterThanOrEqual(0);
  });

  for (const file of readdirSync(dir).filter(f => /\.ya?ml$/.test(f))) {
    it(`${file} is valid YAML with triggers and jobs`, () => {
      const doc = parseDocument(readFileSync(join(dir, file), 'utf8'));
      expect(doc.errors.map(e => e.message)).toEqual([]);
      const wf = doc.toJS();
      expect(wf.on).toBeTruthy();
      expect(Object.keys(wf.jobs ?? {}).length).toBeGreaterThan(0);
    });
  }
});
