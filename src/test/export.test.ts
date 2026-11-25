import { describe, expect, it } from 'vitest';
import { rowsToCsv, type ExportRow } from '@/lib/export';

const row: ExportRow = {
  id: 'a', name: '=HYPERLINK("x")', org: '@evil', category: 'c', license: 'MIT', language: 'Python', stars: 5,
  status: 'active', year: 2026, repo: 'o/a', tags: '+1', tagline: 'plain, text', live: 'no',
};

describe('rowsToCsv', () => {
  it('neutralizes spreadsheet formulas from third-party text', () => {
    const line = rowsToCsv([row]).split('\n')[1];
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain("'@evil");
    expect(line).toContain("'+1");
    expect(line).toContain('"plain, text"');
    expect(line).toContain(',5,');
  });
});
