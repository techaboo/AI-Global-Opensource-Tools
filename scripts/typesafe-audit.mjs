/**
 * Pure helpers for batching the TypeSafe semantic review (typesafe-review.mjs)
 * across the whole catalog over time, instead of reviewing all ~500+ tools (and
 * paying for all those calls) in one run. See scripts/audit-catalog.mjs for the
 * CLI that drives these with real network calls.
 */

export const DEFAULT_BATCH_SIZE = 50;
export const CATEGORY_MISMATCH_CONFIDENCE = 0.7;
export const LICENSE_CONFLICT_THRESHOLD = 0.5;
export const TAGLINE_INACCURATE_THRESHOLD = 0.5;
export const STATUS_IMPLAUSIBLE_SCORE = 0.75;

/**
 * Orders tools least-recently-reviewed first (never-reviewed tools sort first of
 * all, since a missing timestamp is the empty string), then takes the first `size`.
 */
export function selectBatch(tools, state, size = DEFAULT_BATCH_SIZE) {
  return [...tools]
    .sort((a, b) => {
      const ra = state[a.id]?.reviewedAt ?? '';
      const rb = state[b.id]?.reviewedAt ?? '';
      return ra < rb ? -1 : ra > rb ? 1 : 0;
    })
    .slice(0, size);
}

/** Turns one reviewCandidate() result into a list of human-readable flag reasons. */
export function classify(tool, result) {
  const reasons = [];

  for (const { tool: dupTool, noul } of result.duplicates) {
    reasons.push(`possible duplicate of **${dupTool.name}** (\`${dupTool.id}\`) — noul ${noul.toFixed(2)}`);
  }
  if (!result.category.matchesCurrent && result.category.confidence >= CATEGORY_MISMATCH_CONFIDENCE) {
    reasons.push(`category mismatch: catalog says \`${result.category.current}\`, model suggests \`${result.category.suggested}\` (confidence ${result.category.confidence.toFixed(2)})`);
  }
  if (result.metadata.licenseConflict >= LICENSE_CONFLICT_THRESHOLD) {
    reasons.push(`possible license conflict (noul ${result.metadata.licenseConflict.toFixed(2)})`);
  }
  if (result.metadata.taglineAccurate < TAGLINE_INACCURATE_THRESHOLD) {
    reasons.push(`tagline may not reflect the description (noul ${result.metadata.taglineAccurate.toFixed(2)})`);
  }
  if (result.metadata.statusPlausibility.score < STATUS_IMPLAUSIBLE_SCORE) {
    reasons.push(`status \`${tool.status}\` may be implausible (score ${result.metadata.statusPlausibility.score.toFixed(2)}/2)`);
  }

  return reasons;
}

/** Renders the markdown report body for a completed (or partial) audit run. */
export function renderReport({ reviewedCount, requestedCount, batchSize, coverage, totalTools, flagged }) {
  const lines = [
    '# TypeSafe catalog audit',
    '',
    `Last run: ${new Date().toISOString()}`,
    `Reviewed this run: ${reviewedCount} / ${requestedCount} requested (batch size ${batchSize})`,
    `Catalog coverage: ${coverage} / ${totalTools} tools have been reviewed at least once`,
    '',
  ];
  if (flagged.length === 0) {
    lines.push('No findings in this batch.');
  } else {
    lines.push(`## ${flagged.length} tool(s) flagged this run`, '');
    for (const { tool, reasons } of flagged) {
      lines.push(`### ${tool.name} (\`${tool.id}\`)`);
      for (const reason of reasons) lines.push(`- ${reason}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
