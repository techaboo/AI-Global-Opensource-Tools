// Pure catalog view logic: URL <-> state and filtering/sorting. No React, so it
// is unit-tested directly (src/test/catalogView.test.ts) instead of only through App.
import type { AITool, Category, LiveMap } from '@/types';
import type { SortKey, ViewMode } from '@/components/FilterBar';
import { parseCompareIds } from '@/lib/compare';

export interface Filters {
  q: string;
  cat: string;
  license: string;
  lang: string;
  status: string;
  fav: boolean;
}

export interface UrlState extends Filters {
  sort: SortKey;
  view: ViewMode;
  cmp: string[];
}

export const DEFAULT_FILTERS: Filters = { q: '', cat: 'all', license: 'all', lang: 'all', status: 'all', fav: false };
const VALID_VIEWS: ViewMode[] = ['grid', 'table', 'analytics', 'compare'];
const VALID_SORTS: SortKey[] = ['stars', 'name', 'year', 'category', 'pushed'];

export function readUrlState(search: string): Partial<UrlState> {
  const p = new URLSearchParams(search);
  const s: Partial<UrlState> = {};
  for (const key of ['cat', 'license', 'lang', 'status', 'q'] as const) {
    const v = p.get(key);
    if (v) s[key] = v;
  }
  const sort = p.get('sort') as SortKey | null;
  if (sort && VALID_SORTS.includes(sort)) s.sort = sort;
  const view = p.get('view') as ViewMode | null;
  if (view && VALID_VIEWS.includes(view)) s.view = view;
  if (p.get('fav') === '1') s.fav = true;
  const cmp = parseCompareIds(p.get('cmp'));
  if (cmp.length >= 2) s.cmp = cmp;
  return s;
}

export function buildUrlQuery(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.cat !== 'all') p.set('cat', s.cat);
  if (s.sort !== 'stars') p.set('sort', s.sort);
  if (s.license !== 'all') p.set('license', s.license);
  if (s.lang !== 'all') p.set('lang', s.lang);
  if (s.status !== 'all') p.set('status', s.status);
  if (s.view !== 'grid') p.set('view', s.view);
  if (s.fav) p.set('fav', '1');
  if (s.q) p.set('q', s.q);
  if (s.view === 'compare' && s.cmp.length >= 2) p.set('cmp', s.cmp.join(','));
  return p.toString();
}

/** Tools matching every filter. Pass ignoreCategory for the compare pool, which spans categories. */
export function filterTools(
  tools: AITool[],
  f: Filters,
  favorites: ReadonlySet<string>,
  catMap: ReadonlyMap<string, Category>,
  { ignoreCategory = false } = {},
): AITool[] {
  const q = f.q.trim().toLowerCase();
  return tools.filter(t => {
    if (f.fav && !favorites.has(t.id)) return false;
    if (!ignoreCategory && f.cat !== 'all' && t.cat !== f.cat) return false;
    if (f.license !== 'all' && t.license !== f.license) return false;
    if (f.lang !== 'all' && t.lang !== f.lang) return false;
    if (f.status !== 'all' && t.status !== f.status) return false;
    if (q) {
      const hay = `${t.name} ${t.org} ${t.tagline} ${t.desc} ${t.license} ${t.lang} ${t.tags.join(' ')} ${catMap.get(t.cat)?.label ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortTools(tools: AITool[], sort: SortKey, liveMap: LiveMap): AITool[] {
  const starsOf = (t: AITool) => liveMap[t.id]?.stars ?? t.stars;
  const pushedOf = (t: AITool) => liveMap[t.id]?.pushedAt ?? '';
  return [...tools].sort((a, b) => {
    switch (sort) {
      case 'stars': return starsOf(b) - starsOf(a);
      case 'name': return a.name.localeCompare(b.name);
      case 'year': return b.year - a.year || starsOf(b) - starsOf(a);
      case 'category': return a.cat.localeCompare(b.cat) || starsOf(b) - starsOf(a);
      case 'pushed': return pushedOf(b).localeCompare(pushedOf(a)) || starsOf(b) - starsOf(a);
      default: return 0;
    }
  });
}
