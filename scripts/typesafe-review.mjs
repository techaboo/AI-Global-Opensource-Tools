/**
 * TypeSafe-powered semantic review for a candidate catalog entry, used before a new
 * tool is merged into `src/data/tools.ts`. `npm run check-duplicates` only catches
 * exact id/name/repo collisions (see catalog.mjs); this adds three judgments that
 * plain string matching cannot make:
 *
 *   1. duplicate   - is the candidate the same project as an existing entry under a
 *                    different name (rename, fork, rebrand)?
 *   2. category    - does the candidate's claimed category match what its own
 *                    tagline/description actually describe?
 *   3. metadata    - is the claimed license plausible, and is the tagline a neutral,
 *                    supported summary of the description (not promotional copy)?
 *
 * Calls https://api.typesafe.ai/v1/systemone directly (no SDK dependency). Requires
 * TYPESAFE_API_KEY; reviewCandidate() returns { skipped: true } without one so this
 * never breaks a contributor's workflow when the key is absent.
 */

const API_URL = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
export const SHORTLIST_SIZE = 6;
export const SHORTLIST_FLOOR = 0.15;
export const DUPLICATE_THRESHOLD = 0.5;

// ---- deterministic pre-filter (code's job: narrow candidates before asking anything) ----

function bigrams(value) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const grams = new Set();
  for (let i = 0; i < normalized.length - 1; i++) grams.add(normalized.slice(i, i + 2));
  return grams;
}

/** Dice coefficient over character bigrams: cheap, order-insensitive name similarity. */
export function diceSimilarity(a, b) {
  if (!a || !b) return 0;
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const gram of left) if (right.has(gram)) overlap++;
  return (2 * overlap) / (left.size + right.size);
}

/** Ranks existing tools by rough similarity to `candidate` and keeps the top matches. */
export function shortlistCandidates(candidate, tools, { size = SHORTLIST_SIZE, floor = SHORTLIST_FLOOR } = {}) {
  return tools
    .filter(tool => tool.id !== candidate.id)
    .map(tool => ({
      tool,
      score: Math.max(
        diceSimilarity(candidate.name, tool.name),
        diceSimilarity(candidate.org, tool.org) * 0.8,
        candidate.repo && tool.repo && candidate.repo.toLowerCase() === tool.repo.toLowerCase() ? 1 : 0,
      ),
    }))
    .filter(entry => entry.score >= floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map(entry => entry.tool);
}

// ---- TypeSafe request ----

function pickFields(tool) {
  return { name: tool.name, org: tool.org, tagline: tool.tagline, desc: tool.desc, repo: tool.repo ?? null };
}

export function buildState(candidate, shortlist) {
  return {
    candidate: pickFields(candidate),
    shortlist: Object.fromEntries(shortlist.map((tool, i) => [`existing_${i}`, pickFields(tool)])),
  };
}

export function buildQuestions(shortlist, categories) {
  const questions = {};

  shortlist.forEach((_tool, i) => {
    questions[`duplicate_${i}`] = {
      type: 'noul',
      instructions: `Is \`candidate\` the same open-source project as \`shortlist.existing_${i}\`? A rename, fork, or rebrand of the same project counts as yes; a different, independently-built project with a similar name or focus counts as no.`,
    };
  });

  questions.category = {
    type: 'choice',
    instructions: "Based on `candidate.tagline` and `candidate.desc`, which category does this project actually belong in?",
    criteria: Object.fromEntries(categories.map(c => [c.id, c.blurb])),
  };

  questions.license_conflict = {
    type: 'noul',
    instructions: '`candidate` claims an open-source license. Does `candidate.desc` or `candidate.tagline` contain anything that contradicts being genuinely open source (e.g. described as closed-source, proprietary, source-available only, or a paid-only hosted product with no public code)?',
  };

  questions.tagline_accurate = {
    type: 'noul',
    instructions: 'Does `candidate.tagline` accurately and neutrally summarize `candidate.desc`, without promotional exaggeration or claims the description does not support?',
  };

  questions.status_plausible = {
    type: 'score',
    instructions: 'Given `candidate.desc` and `candidate.tagline`, how plausible is the catalog status that was recorded for this project?',
    criteria: [
      'Clearly contradicts the description (e.g. recorded as active but the text describes it as discontinued, archived, or abandoned)',
      'Ambiguous; the description does not clearly support or contradict the recorded status',
      'Clearly consistent with the description',
    ],
  };

  return questions;
}

async function callSystemOne(state, questions, { apiKey = process.env.TYPESAFE_API_KEY, retries = 3 } = {}) {
  if (!apiKey) return null;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, state, questions }),
    });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status === 529) && attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 500));
      continue;
    }
    throw new Error(`TypeSafe request failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Reviews one candidate tool (already in the catalog, or not yet added) against the
 * rest of `catalog`. Returns `{ skipped: true, reason }` when TYPESAFE_API_KEY is unset.
 */
export async function reviewCandidate(candidate, catalog, options = {}) {
  const required = ['id', 'name', 'org', 'tagline', 'desc', 'license', 'cat', 'status'];
  const missing = required.filter(field => !candidate?.[field]);
  if (missing.length) throw new Error(`Candidate is missing required field(s): ${missing.join(', ')}`);

  const shortlist = shortlistCandidates(candidate, catalog.tools, options);
  const state = buildState(candidate, shortlist);
  const questions = buildQuestions(shortlist, catalog.categories);
  const response = await callSystemOne(state, questions, options);
  if (!response) return { skipped: true, reason: 'TYPESAFE_API_KEY is not set' };

  const { answers } = response;
  const duplicates = shortlist
    .map((tool, i) => ({ tool, noul: answers[`duplicate_${i}`].noul }))
    .filter(entry => entry.noul >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.noul - a.noul);

  return {
    skipped: false,
    duplicates,
    category: {
      current: candidate.cat,
      suggested: answers.category.choice,
      confidence: answers.category.confidence,
      matchesCurrent: answers.category.choice === candidate.cat,
    },
    metadata: {
      licenseConflict: answers.license_conflict.noul,
      taglineAccurate: answers.tagline_accurate.noul,
      statusPlausibility: answers.status_plausible,
    },
    usage: response.usage,
  };
}
