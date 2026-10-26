import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { ROOT } from './catalog.mjs';

// A workflow file that fails to parse silently disables a scheduled bot
// (GitHub just records a "workflow file issue"), so parse every one in CI.
const dir = join(ROOT, '.github/workflows');

describe('GitHub workflow files', () => {
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
