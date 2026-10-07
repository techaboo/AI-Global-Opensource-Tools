import { describe, expect, it } from 'vitest';
import { classify, renderReport, selectBatch } from './typesafe-audit.mjs';

const tools = [
  { id: 'a', name: 'A', status: 'active' },
  { id: 'b', name: 'B', status: 'active' },
  { id: 'c', name: 'C', status: 'active' },
];

function cleanResult(overrides = {}) {
  return {
    duplicates: [],
    category: { current: 'agents', suggested: 'agents', confidence: 0.9, matchesCurrent: true },
    metadata: {
      licenseConflict: 0.05,
      taglineAccurate: 0.9,
      statusPlausibility: { score: 1.8, legend: {} },
    },
    ...overrides,
  };
}

describe('selectBatch', () => {
  it('puts never-reviewed tools first', () => {
    const state = { a: { reviewedAt: '2026-01-01T00:00:00Z' } };
    const batch = selectBatch(tools, state, 2);
    expect(batch.map(t => t.id)).toEqual(['b', 'c']);
  });

  it('orders reviewed tools oldest-first', () => {
    const state = {
      a: { reviewedAt: '2026-03-01T00:00:00Z' },
      b: { reviewedAt: '2026-01-01T00:00:00Z' },
      c: { reviewedAt: '2026-02-01T00:00:00Z' },
    };
    expect(selectBatch(tools, state, 3).map(t => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('respects the requested size', () => {
    expect(selectBatch(tools, {}, 1)).toHaveLength(1);
  });
});

describe('classify', () => {
  it('returns no reasons for a clean result', () => {
    expect(classify(tools[0], cleanResult())).toEqual([]);
  });

  it('flags a high-confidence category mismatch but not a low-confidence one', () => {
    const mismatch = cleanResult({ category: { current: 'agents', suggested: 'rag', confidence: 0.8, matchesCurrent: false } });
    expect(classify(tools[0], mismatch).some(r => r.includes('category mismatch'))).toBe(true);

    const lowConfidence = cleanResult({ category: { current: 'agents', suggested: 'rag', confidence: 0.5, matchesCurrent: false } });
    expect(classify(tools[0], lowConfidence).some(r => r.includes('category mismatch'))).toBe(false);
  });

  it('flags a suspected duplicate', () => {
    const result = cleanResult({ duplicates: [{ tool: { id: 'dup', name: 'Dup' }, noul: 0.91 }] });
    expect(classify(tools[0], result)[0]).toContain('possible duplicate of **Dup**');
  });

  it('flags a license conflict and an inaccurate tagline', () => {
    const result = cleanResult({ metadata: { licenseConflict: 0.7, taglineAccurate: 0.2, statusPlausibility: { score: 1.8, legend: {} } } });
    const reasons = classify(tools[0], result);
    expect(reasons.some(r => r.includes('license conflict'))).toBe(true);
    expect(reasons.some(r => r.includes('tagline may not reflect'))).toBe(true);
  });

  it('flags an implausible status', () => {
    const result = cleanResult({ metadata: { licenseConflict: 0.05, taglineAccurate: 0.9, statusPlausibility: { score: 0.3, legend: {} } } });
    expect(classify(tools[0], result)[0]).toContain('may be implausible');
  });
});

describe('renderReport', () => {
  it('reports a clean run', () => {
    const report = renderReport({ reviewedCount: 10, requestedCount: 10, batchSize: 50, coverage: 10, totalTools: 100, flagged: [] });
    expect(report).toContain('Reviewed this run: 10 / 10 requested (batch size 50)');
    expect(report).toContain('Catalog coverage: 10 / 100');
    expect(report).toContain('No findings in this batch.');
  });

  it('lists flagged tools with their reasons', () => {
    const report = renderReport({
      reviewedCount: 1,
      requestedCount: 1,
      batchSize: 50,
      coverage: 1,
      totalTools: 100,
      flagged: [{ tool: { id: 'x', name: 'X' }, reasons: ['possible license conflict (noul 0.80)'] }],
    });
    expect(report).toContain('1 tool(s) flagged this run');
    expect(report).toContain('### X (`x`)');
    expect(report).toContain('- possible license conflict (noul 0.80)');
  });
});
