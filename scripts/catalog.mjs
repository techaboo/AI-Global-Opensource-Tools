import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG_PATH = join(ROOT, 'src/data/tools.ts');
export const SNAPSHOT_PATH = join(ROOT, 'public/live-snapshot.json');

const TOOL_FIELDS = new Set([
  'id', 'name', 'org', 'cat', 'tagline', 'desc', 'license', 'lang',
  'stars', 'repo', 'tags', 'hot', 'status', 'year', 'url', 'website', 'homepage',
]);
const CATEGORY_FIELDS = new Set(['id', 'label', 'icon', 'color', 'blurb']);
const REQUIRED_TOOL_STRINGS = ['id', 'name', 'org', 'cat', 'tagline', 'desc', 'license', 'lang', 'status'];
const REQUIRED_CATEGORY_STRINGS = ['id', 'label', 'icon', 'color', 'blurb'];
const TOOL_STATUSES = new Set(['active', 'maintenance', 'archived']);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

function describeDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start == null) return message;
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
}

/** Load the actual exported values from tools.ts without depending on its formatting. */
export async function loadCatalog(catalogPath = CATALOG_PATH) {
  const source = readFileSync(catalogPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: catalogPath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      sourceMap: false,
    },
  });
  const diagnostics = (compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length) {
    throw new Error(`Unable to parse catalog:\n${diagnostics.map(describeDiagnostic).join('\n')}`);
  }

  const sourceUrl = pathToFileURL(catalogPath).href;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${compiled.outputText}\n//# sourceURL=${sourceUrl}`).toString('base64')}`;
  let exports;
  try {
    exports = await import(moduleUrl);
  } catch (error) {
    throw new Error(`Unable to evaluate ${catalogPath}: ${error.message}`, { cause: error });
  }
  if (!Array.isArray(exports.TOOLS)) throw new Error('Catalog must export TOOLS as an array.');
  if (!Array.isArray(exports.CATEGORIES)) throw new Error('Catalog must export CATEGORIES as an array.');
  return { tools: exports.TOOLS, categories: exports.CATEGORIES, snapshotDate: exports.SNAPSHOT_DATE };
}

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : null;
}

function validDate(value) {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

function validateUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function findDuplicates(records, key, label, errors, { optional = false } = {}) {
  const seen = new Map();
  records.forEach((record, index) => {
    const value = normalized(record?.[key]);
    if (optional && !value) return;
    if (!value) return;
    if (seen.has(value)) errors.push(`${label} ${index} duplicates ${key} ${JSON.stringify(record[key])} from ${label} ${seen.get(value)}.`);
    else seen.set(value, index);
  });
}

export function validateCatalog({ tools, categories, snapshotDate }) {
  const errors = [];
  const warnings = [];
  if (tools.length === 0) errors.push('TOOLS must not be empty.');
  if (categories.length === 0) errors.push('CATEGORIES must not be empty.');

  findDuplicates(categories, 'id', 'category', errors);
  findDuplicates(categories, 'label', 'category', errors);
  findDuplicates(tools, 'id', 'tool', errors);
  findDuplicates(tools, 'name', 'tool', errors);
  findDuplicates(tools, 'repo', 'tool', errors, { optional: true });

  const categoryIds = new Set(categories.map(c => normalized(c?.id)).filter(Boolean));
  const usedCategories = new Set();

  categories.forEach((category, index) => {
    const at = `category[${index}]`;
    if (!category || typeof category !== 'object' || Array.isArray(category)) {
      errors.push(`${at} must be an object.`);
      return;
    }
    for (const field of REQUIRED_CATEGORY_STRINGS) {
      if (typeof category[field] !== 'string' || !category[field].trim()) errors.push(`${at}.${field} must be a non-empty string.`);
      else if (category[field] !== category[field].trim()) errors.push(`${at}.${field} must not have surrounding whitespace.`);
    }
    if (typeof category.id === 'string' && !SLUG_RE.test(category.id)) errors.push(`${at}.id must be a lowercase kebab-case identifier.`);
    if (typeof category.color === 'string' && !HEX_RE.test(category.color)) errors.push(`${at}.color must be a six-digit hex color.`);
    for (const field of Object.keys(category)) if (!CATEGORY_FIELDS.has(field)) warnings.push(`${at} has unexpected field ${JSON.stringify(field)}.`);
  });

  const latestReasonableYear = new Date().getUTCFullYear() + 1;
  tools.forEach((tool, index) => {
    const at = `tool[${index}]${typeof tool?.id === 'string' ? ` (${tool.id})` : ''}`;
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
      errors.push(`${at} must be an object.`);
      return;
    }
    for (const field of REQUIRED_TOOL_STRINGS) {
      if (typeof tool[field] !== 'string' || !tool[field].trim()) errors.push(`${at}.${field} must be a non-empty string.`);
      else if (tool[field] !== tool[field].trim()) errors.push(`${at}.${field} must not have surrounding whitespace.`);
    }
    if (typeof tool.id === 'string' && !SLUG_RE.test(tool.id)) errors.push(`${at}.id must be a lowercase kebab-case identifier.`);
    if (typeof tool.cat === 'string') {
      const cat = normalized(tool.cat);
      usedCategories.add(cat);
      if (!categoryIds.has(cat)) errors.push(`${at}.cat references unknown category ${JSON.stringify(tool.cat)}.`);
    }
    if (typeof tool.status === 'string' && !TOOL_STATUSES.has(tool.status)) errors.push(`${at}.status must be one of ${[...TOOL_STATUSES].join(', ')}.`);
    if (!Number.isSafeInteger(tool.stars) || tool.stars < 0) errors.push(`${at}.stars must be a non-negative safe integer.`);
    if (!Number.isInteger(tool.year) || tool.year < 1950 || tool.year > latestReasonableYear) errors.push(`${at}.year must be an integer from 1950 through ${latestReasonableYear}.`);
    if (tool.repo !== undefined && (typeof tool.repo !== 'string' || !REPO_RE.test(tool.repo) || tool.repo.endsWith('.git'))) errors.push(`${at}.repo must use GitHub owner/name form, not a URL.`);
    for (const field of ['url', 'website', 'homepage']) {
      if (tool[field] !== undefined && !validateUrl(tool[field])) errors.push(`${at}.${field} must be an absolute http(s) URL.`);
    }
    if (!Array.isArray(tool.tags) || tool.tags.length === 0) errors.push(`${at}.tags must be a non-empty array.`);
    else {
      const seenTags = new Set();
      tool.tags.forEach((tag, tagIndex) => {
        if (typeof tag !== 'string' || !tag.trim()) errors.push(`${at}.tags[${tagIndex}] must be a non-empty string.`);
        else {
          if (tag !== tag.trim()) errors.push(`${at}.tags[${tagIndex}] must not have surrounding whitespace.`);
          const key = normalized(tag);
          if (seenTags.has(key)) errors.push(`${at}.tags contains duplicate ${JSON.stringify(tag)}.`);
          seenTags.add(key);
        }
      });
    }
    if (tool.hot !== undefined && typeof tool.hot !== 'boolean') errors.push(`${at}.hot must be boolean when present.`);
    if (typeof tool.tagline === 'string' && typeof tool.desc === 'string' && normalized(tool.tagline) === normalized(tool.desc)) warnings.push(`${at} repeats its tagline as its description.`);
    for (const field of Object.keys(tool)) if (!TOOL_FIELDS.has(field)) warnings.push(`${at} has unexpected field ${JSON.stringify(field)}.`);
  });

  for (const category of categoryIds) if (!usedCategories.has(category)) warnings.push(`Category ${JSON.stringify(category)} has no tools.`);
  if (!validDate(snapshotDate)) errors.push('SNAPSHOT_DATE must be a valid date string.');

  return { errors, warnings };
}

export function validateSnapshot(snapshot, catalog) {
  const errors = [];
  const warnings = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return { errors: ['Snapshot root must be an object.'], warnings };
  if (!validDate(snapshot.generatedAt)) errors.push('snapshot.generatedAt must be a valid date string.');
  if (!snapshot.repos || typeof snapshot.repos !== 'object' || Array.isArray(snapshot.repos)) return { errors: [...errors, 'snapshot.repos must be an object.'], warnings };

  const toolById = new Map(catalog.tools.map(tool => [tool.id, tool]));
  for (const [id, entry] of Object.entries(snapshot.repos)) {
    const at = `snapshot.repos[${JSON.stringify(id)}]`;
    const tool = toolById.get(id);
    if (!tool) errors.push(`${at} does not match a catalog tool id.`);
    else if (!tool.repo) errors.push(`${at} belongs to a tool without a GitHub repo.`);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${at} must be an object.`);
      continue;
    }
    for (const field of ['stars', 'forks', 'openIssues', 'fetchedAt']) if (!Number.isSafeInteger(entry[field]) || entry[field] < 0) errors.push(`${at}.${field} must be a non-negative safe integer.`);
    if (!validDate(entry.pushedAt)) errors.push(`${at}.pushedAt must be a valid date string.`);
    if (!Array.isArray(entry.history)) errors.push(`${at}.history must be an array.`);
    else {
      if (entry.history.length > 52) errors.push(`${at}.history exceeds the 52-point limit.`);
      let previous = -1;
      entry.history.forEach((point, index) => {
        if (!point || typeof point !== 'object' || !Number.isSafeInteger(point.t) || point.t < 0 || !Number.isSafeInteger(point.s) || point.s < 0) errors.push(`${at}.history[${index}] must contain non-negative integer t and s values.`);
        else {
          if (point.t <= previous) errors.push(`${at}.history must be strictly chronological (problem at index ${index}).`);
          previous = point.t;
        }
      });
      const last = entry.history.at(-1);
      if (last && Number.isSafeInteger(last.t) && last.t !== entry.fetchedAt) warnings.push(`${at} latest history time does not equal fetchedAt.`);
      if (last && Number.isSafeInteger(last.s) && last.s !== entry.stars) warnings.push(`${at} latest history stars do not equal stars.`);
    }
  }
  for (const tool of catalog.tools) if (tool.repo && !Object.hasOwn(snapshot.repos, tool.id)) warnings.push(`No live snapshot entry for ${tool.id} (${tool.repo}).`);
  return { errors, warnings };
}

export function readSnapshot(snapshotPath = SNAPSHOT_PATH) {
  try {
    return JSON.parse(readFileSync(snapshotPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${snapshotPath}: ${error.message}`, { cause: error });
  }
}
