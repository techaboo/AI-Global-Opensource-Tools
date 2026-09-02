import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, TOOLS, SNAPSHOT_DATE } from '@/data/tools';
import type { AITool } from '@/types';
import { useGitHubSync } from '@/hooks/useGitHubSync';
import { Header } from '@/components/Header';
import { CategoryNav, CategoryIcon } from '@/components/CategoryNav';
import { StatsBar } from '@/components/StatsBar';
import { FilterBar, type SortKey, type ViewMode } from '@/components/FilterBar';
import { ToolCard } from '@/components/ToolCard';
import { ToolTable } from '@/components/ToolTable';
import { ToolDetail } from '@/components/ToolDetail';
import { Analytics } from '@/components/Analytics';
import { cn } from '@/lib/utils';

const CAT_MAP = new Map(CATEGORIES.map(c => [c.id, c]));

const FAV_KEY = 'osi-atlas-favorites-v1';
const THEME_KEY = 'osi-atlas-theme-v1';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

// ─── URL state helpers ────────────────────────────────────────────
interface UrlState {
  cat: string;
  sort: SortKey;
  license: string;
  lang: string;
  status: string;
  view: ViewMode;
  fav: boolean;
  q: string;
}

const VALID_VIEWS: ViewMode[] = ['grid', 'table', 'analytics'];
const VALID_SORTS: SortKey[] = ['stars', 'name', 'year', 'category', 'pushed'];

function readUrlState(): Partial<UrlState> {
  const p = new URLSearchParams(window.location.search);
  const s: Partial<UrlState> = {};
  if (p.get('cat')) s.cat = p.get('cat')!;
  if (p.get('sort') && VALID_SORTS.includes(p.get('sort') as SortKey)) s.sort = p.get('sort') as SortKey;
  if (p.get('license')) s.license = p.get('license')!;
  if (p.get('lang')) s.lang = p.get('lang')!;
  if (p.get('status')) s.status = p.get('status')!;
  if (p.get('view') && VALID_VIEWS.includes(p.get('view') as ViewMode)) s.view = p.get('view') as ViewMode;
  if (p.get('fav') === '1') s.fav = true;
  if (p.get('q')) s.q = p.get('q')!;
  return s;
}

function writeUrlState(s: UrlState) {
  const p = new URLSearchParams();
  if (s.cat && s.cat !== 'all') p.set('cat', s.cat);
  if (s.sort && s.sort !== 'stars') p.set('sort', s.sort);
  if (s.license && s.license !== 'all') p.set('license', s.license);
  if (s.lang && s.lang !== 'all') p.set('lang', s.lang);
  if (s.status && s.status !== 'all') p.set('status', s.status);
  if (s.view && s.view !== 'grid') p.set('view', s.view);
  if (s.fav) p.set('fav', '1');
  if (s.q) p.set('q', s.q);
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? '?' + qs : ''}`;
  window.history.replaceState(null, '', url);
}

export default function App() {
  // ─── State (URL-restorable where applicable) ──────────────────────
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === null ? true : v === 'dark';
    } catch {
      return true;
    }
  });
  const urlState = useMemo(readUrlState, []);
  const [search, setSearch] = useState(urlState.q ?? '');
  const [activeCat, setActiveCat] = useState(urlState.cat ?? 'all');
  const [sort, setSort] = useState<SortKey>(urlState.sort ?? 'stars');
  const [license, setLicense] = useState(urlState.license ?? 'all');
  const [lang, setLang] = useState(urlState.lang ?? 'all');
  const [status, setStatus] = useState(urlState.status ?? 'all');
  const [view, setView] = useState<ViewMode>(urlState.view ?? 'grid');
  const [onlyFav, setOnlyFav] = useState(urlState.fav ?? false);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [selected, setSelected] = useState<AITool | null>(null);
  const searchRef = useRef<string>('');

  const { liveMap, syncing, progress, rateLimited, token, saveToken, syncTools, fetchOne, lastSync, syncedCount } = useGitHubSync();

  // ─── Effects: theme persistence ───────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch { /* ignore */ }
  }, [dark]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // ─── Effects: URL state sync (debounced) ──────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      writeUrlState({ cat: activeCat, sort, license, lang, status, view, fav: onlyFav, q: search });
    }, 300);
    return () => clearTimeout(t);
  }, [activeCat, sort, license, lang, status, view, onlyFav, search]);

  // ─── Effects: favorites persistence ───────────────────────────────
  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('header input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of TOOLS) m[t.cat] = (m[t.cat] ?? 0) + 1;
    return m;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = TOOLS.filter(t => {
      if (onlyFav && !favorites.has(t.id)) return false;
      if (activeCat !== 'all' && t.cat !== activeCat) return false;
      if (license !== 'all' && t.license !== license) return false;
      if (lang !== 'all' && t.lang !== lang) return false;
      if (status !== 'all' && t.status !== status) return false;
      if (q) {
        const hay = `${t.name} ${t.org} ${t.tagline} ${t.desc} ${t.license} ${t.lang} ${t.tags.join(' ')} ${CAT_MAP.get(t.cat)?.label ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const starsOf = (t: AITool) => liveMap[t.id]?.stars ?? t.stars;
    const pushedOf = (t: AITool) => liveMap[t.id]?.pushedAt ?? '';
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'stars': return starsOf(b) - starsOf(a);
        case 'name': return a.name.localeCompare(b.name);
        case 'year': return b.year - a.year || starsOf(b) - starsOf(a);
        case 'category': return a.cat.localeCompare(b.cat) || starsOf(b) - starsOf(a);
        case 'pushed': return (pushedOf(b) || '').localeCompare(pushedOf(a) || '') || starsOf(b) - starsOf(a);
        default: return 0;
      }
    });
    return list;
  }, [search, activeCat, license, lang, status, sort, liveMap, onlyFav, favorites]);

  const hasFilters = search !== '' || activeCat !== 'all' || license !== 'all' || lang !== 'all' || status !== 'all' || onlyFav;
  const clearFilters = () => { setSearch(''); setActiveCat('all'); setLicense('all'); setLang('all'); setStatus('all'); setOnlyFav(false); };

  const activeCategory = activeCat !== 'all' ? CAT_MAP.get(activeCat) : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        search={search}
        onSearch={setSearch}
        syncing={syncing}
        progress={progress}
        rateLimited={rateLimited}
        syncedCount={syncedCount}
        lastSync={lastSync}
        onSync={() => syncTools(filtered, 60)}
        token={token}
        onSaveToken={saveToken}
        onlyFav={onlyFav}
        onToggleFav={() => setOnlyFav(f => !f)}
        favCount={favorites.size}
      />

      <div className="flex">
        <CategoryNav
          categories={CATEGORIES}
          counts={counts}
          total={TOOLS.length}
          active={activeCat}
          onSelect={id => { setActiveCat(id); if (view === 'analytics' && id !== 'all') setView('grid'); }}
        />

        <main className="flex-1 min-w-0 px-4 lg:px-6 py-5 space-y-5">
          {/* Mobile category chips */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>All ({TOOLS.length})</Chip>
            {CATEGORIES.map(c => (
              <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} color={c.color}>
                <span className="inline-flex items-center gap-1"><CategoryIcon icon={c.icon} className="h-3 w-3" />{c.label}</span>
              </Chip>
            ))}
          </div>

          {/* Category banner */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-5 relative overflow-hidden">
            <div
              className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-25"
              style={{ background: activeCategory?.color ?? '#d946ef' }}
            />
            <div className="relative">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
                {activeCategory && <CategoryIcon icon={activeCategory.icon} className="h-6 w-6" style={{ color: activeCategory.color }} />}
                {activeCategory ? activeCategory.label : 'The Open-Source AI Universe'}
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">
                {activeCategory
                  ? activeCategory.blurb
                  : `A researched catalog of ${TOOLS.length} open-source AI tools across ${CATEGORIES.length} categories — from foundation models to robotics. Snapshot: ${SNAPSHOT_DATE}; sync GitHub for live stars.`}
              </p>
            </div>
          </div>

          <StatsBar tools={filtered} liveMap={liveMap} syncedCount={syncedCount} />

          <FilterBar
            sort={sort} onSort={setSort}
            license={license} onLicense={setLicense}
            lang={lang} onLang={setLang}
            status={status} onStatus={setStatus}
            view={view} onView={setView}
            count={filtered.length} total={TOOLS.length}
            onClear={clearFilters} hasFilters={hasFilters}
          />

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <div className="text-4xl mb-3">🔍</div>
              <div className="font-medium text-foreground mb-1">No tools match your filters</div>
              <button onClick={clearFilters} className="text-fuchsia-500 hover:text-fuchsia-400 text-sm font-medium">Reset all filters</button>
            </div>
          )}

          {view === 'grid' && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3.5">
              {filtered.map(t => (
                <ToolCard key={t.id} tool={t} category={CAT_MAP.get(t.cat)} live={liveMap[t.id]} onOpen={setSelected} isFavorite={favorites.has(t.id)} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          )}

          {view === 'table' && filtered.length > 0 && (
            <ToolTable tools={filtered} catMap={CAT_MAP} liveMap={liveMap} onOpen={setSelected} />
          )}

          {view === 'analytics' && filtered.length > 0 && (
            <Analytics tools={filtered} liveMap={liveMap} onSelectCategory={id => { setActiveCat(id); setView('grid'); }} />
          )}

          <footer className="pt-6 pb-4 text-center text-[11px] text-muted-foreground space-y-1">
            <p>Open Source AI Atlas · {TOOLS.length} tools · {CATEGORIES.length} categories · research snapshot {SNAPSHOT_DATE}</p>
            <p>Star/fork data: GitHub REST API — 60 req/hr unauthenticated or 5,000 req/hr with a token. Cached in your browser.</p>
          </footer>
        </main>
      </div>

      <ToolDetail
        tool={selected}
        category={selected ? CAT_MAP.get(selected.cat) : undefined}
        live={selected ? liveMap[selected.id] : undefined}
        onClose={() => setSelected(null)}
        onFetchLive={fetchOne}
        isFavorite={selected ? favorites.has(selected.id) : false}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap',
        active ? 'text-foreground border-transparent' : 'border-border text-muted-foreground hover:text-foreground'
      )}
      style={active ? { background: `${color ?? '#d946ef'}26` } : undefined}
    >
      {children}
    </button>
  );
}