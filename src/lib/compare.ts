import { CATEGORIES } from '@/data/tools';

export const MAX_COMPARE = 3;

export function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function defaultCompareIds(activeCat: string): string[] {
  if (activeCat !== 'all') {
    const next = CATEGORIES.find(c => c.id !== activeCat)?.id ?? 'inference';
    return [activeCat, next];
  }
  return [CATEGORIES[0]?.id ?? 'models', CATEGORIES[1]?.id ?? 'inference'];
}

export function parseCompareIds(raw: string | null): string[] {
  if (!raw) return [];
  const valid = new Set(CATEGORIES.map(c => c.id));
  const ids = raw.split(',').map(s => s.trim()).filter(id => valid.has(id));
  return dedupeIds(ids).slice(0, MAX_COMPARE);
}
