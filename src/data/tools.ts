import type { AITool, Category } from '@/types';
// The catalog is plain data in catalog.json: automation reads and writes it as
// JSON (scripts/catalog.mjs loadCatalog/writeCatalog), never as TypeScript source.
import catalog from './catalog.json';

export const SNAPSHOT_DATE: string = catalog.snapshotDate;
export const CATEGORIES: Category[] = catalog.categories as Category[];
export const TOOLS: AITool[] = catalog.tools as AITool[];

export const ALL_LICENSES = Array.from(new Set(TOOLS.map(t => t.license))).sort();
export const ALL_LANGUAGES = Array.from(new Set(TOOLS.map(t => t.lang))).sort();
export const ALL_TAGS = Array.from(new Set(TOOLS.flatMap(t => t.tags))).sort();
