import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalog, validateCatalog, writeCatalog } from './catalog.mjs';

describe('catalog JSON round-trip (what the bots do)', () => {
  it('real catalog loads and validates', async () => {
    const catalog = await loadCatalog();
    expect(validateCatalog(catalog).errors).toEqual([]);
  });

  it('append + status edit survive write/reload with no source-text surgery', async () => {
    const catalog = await loadCatalog();
    const path = join(mkdtempSync(join(tmpdir(), 'cat-')), 'catalog.json');
    const before = catalog.tools.length;
    catalog.tools.push({
      id: 'zz-test-tool', name: "O'Brien \\ \"quoted\"", org: 'o', cat: catalog.categories[0].id,
      tagline: 't', desc: 'd', license: 'MIT', lang: 'Python', stars: 1, repo: 'o/zz-test-tool',
      tags: ['x'], status: 'active', year: 2025,
    });
    catalog.tools[0].status = 'archived';
    writeCatalog(catalog, path);
    const again = await loadCatalog(path);
    expect(again.tools).toHaveLength(before + 1);
    expect(again.tools.at(-1).name).toBe("O'Brien \\ \"quoted\"");
    expect(again.tools[0].status).toBe('archived');
    expect(validateCatalog(again).errors).toEqual([]);
    expect(readFileSync(path, 'utf8').endsWith('\n')).toBe(true);
  });
});
