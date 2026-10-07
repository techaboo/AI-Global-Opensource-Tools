import { useState } from 'react';
import { toast } from 'sonner';
import { Moon, Sun, Search, RefreshCw, Radar, Loader2, KeyRound, Check, Star, X, Command, Info, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CATEGORIES, TOOLS } from '@/data/tools';
import { cn } from '@/lib/utils';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  search: string;
  onSearch: (v: string) => void;
  syncing: boolean;
  progress: { done: number; total: number };
  rateLimited: boolean;
  syncedCount: number;
  lastSync: number;
  onSync: () => void;
  hasToken: boolean;
  onSetToken: (t: string) => void;
  onlyFav: boolean;
  onToggleFav: () => void;
  favCount: number;
  onOpenPalette: () => void;
}

const BANNER_DISMISSED_KEY = 'osi-atlas-ratelimit-banner-dismissed-v1';

export function Header({ dark, onToggleDark, search, onSearch, syncing, progress, rateLimited, syncedCount, lastSync, onSync, onSetToken, onlyFav, onToggleFav, favCount, hasToken, onOpenPalette }: Props) {
  const [tokenOpen, setTokenOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch { /* ignore */ }
  };

  const save = () => {
    onSetToken(draft.trim());
    setDraft('');
    setSaved(true);
    toast.success('GitHub token saved', { description: 'Stored only in your browser. Sync limit is now 5,000 req/hr.' });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <a href="#tool-results" className="skip-link">Skip to tool results</a>
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-fuchsia-500/20">
            <Radar className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-bold text-[15px] tracking-tight">Open Source AI Atlas</div>
            <div className="text-[11px] text-muted-foreground">The living map of open AI — {TOOLS.length} tools, {CATEGORIES.length} categories</div>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <label htmlFor="tool-search" className="sr-only">Search tools</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="tool-search"
              type="search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search tools, orgs, tags, licenses…  ( / )"
              className="w-full h-10 rounded-full border border-border bg-muted/50 pl-9 pr-16 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/50 transition placeholder:text-muted-foreground/70"
            />
            <button
              onClick={onOpenPalette}
              aria-label="Open command palette"
              title="Command palette"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Command className="h-3 w-3" />K
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col items-end mr-1">
            {syncing ? (
              <div className="w-40">
                <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Syncing {progress.done}/{progress.total}
                </div>
                <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-1.5" />
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {rateLimited
                  ? hasToken
                    ? 'Rate limited — token quota exhausted'
                    : 'Rate limit hit — add a token (🔑) for 5,000 req/hr'
                  : syncedCount > 0
                    ? `${syncedCount} live · ${lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                    : 'Snapshot data · sync for live stars'}
              </span>
            )}
          </div>

          <div className="relative">
            <Button
              variant="ghost" size="icon"
              onClick={() => setTokenOpen(o => !o)}
              className="rounded-full"
              aria-label="GitHub token settings"
              title={hasToken ? 'GitHub token set (5,000 req/hr)' : 'Add GitHub token for higher rate limits'}
            >
              <KeyRound className={hasToken ? 'h-4.5 w-4.5 text-emerald-500' : 'h-4.5 w-4.5'} />
            </Button>
            {tokenOpen && (
              <div className="absolute right-0 top-11 w-80 rounded-xl border border-border bg-popover p-4 shadow-xl z-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">GitHub API token</div>
                  <button onClick={() => setTokenOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                  Optional. A <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-fuchsia-500 hover:underline">fine-grained personal access token</a> (no scopes needed for public repos) raises sync limits from 60 → 5,000 requests/hour. Stored only in your browser — never sent anywhere except api.github.com.
                </p>
                <div className="flex gap-2">
                  <label htmlFor="github-token" className="sr-only">Personal access token</label>
                  <input
                    id="github-token"
                    type="password"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && save()}
                    placeholder={hasToken ? '••••••••••  (token saved)' : 'github_pat_… or ghp_…'}
                    className="flex-1 h-9 rounded-lg border border-border bg-muted/50 px-3 text-xs outline-none focus:ring-2 focus:ring-fuchsia-500/40 font-mono"
                  />
                  <Button size="sm" onClick={save} disabled={!draft.trim()} className="rounded-lg h-9">
                    {saved ? <Check className="h-3.5 w-3.5" /> : 'Save'}
                  </Button>
                </div>
                {hasToken && (
                  <button
                    onClick={() => { onSetToken(''); setTokenOpen(false); toast('GitHub token removed'); }}
                    className="mt-2 text-[11px] text-rose-500 hover:text-rose-400"
                  >
                    Remove saved token
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Favorites toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFav}
            className={cn('rounded-full relative', onlyFav && 'text-amber-400')}
            aria-label={onlyFav ? 'Show all tools' : 'Show favorites only'}
            title={onlyFav ? 'Showing favorites only' : `Show favorites (${favCount})`}
          >
            <Star className={cn('h-4 w-4', onlyFav && 'fill-amber-400 text-amber-400')} />
            {favCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center px-0.5 tabular-nums">
                {favCount}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="rounded-full gap-1.5"
            aria-label={syncing ? 'Syncing GitHub metadata' : 'Sync GitHub metadata'}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{syncing ? 'Syncing' : 'Sync GitHub'}</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="rounded-full gap-1.5 border-0 bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/30"
          >
            <a href="https://buymeacoffee.com/techabooq" target="_blank" rel="noreferrer" aria-label="Support this project on Buy Me a Coffee">
              <Coffee className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Support</span>
            </a>
          </Button>

          <Button variant="ghost" size="icon" onClick={onToggleDark} className="rounded-full" aria-label="Toggle theme">
            {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </Button>
        </div>
      </div>
      {!hasToken && !bannerDismissed && (
        <div className="flex items-center gap-2 border-t border-border bg-fuchsia-500/5 px-4 lg:px-6 py-2 text-[12px]">
          <Info className="h-3.5 w-3.5 shrink-0 text-fuchsia-500" />
          <span className="text-muted-foreground">
            Live star/fork sync is limited to <strong className="text-foreground">60 requests/hour</strong> on this shared connection. Add your own free GitHub token for <strong className="text-foreground">5,000/hour</strong> — it's stored only in your browser.
          </span>
          <button
            onClick={() => setTokenOpen(true)}
            className="ml-auto shrink-0 rounded-full bg-fuchsia-500/15 px-2.5 py-1 font-medium text-fuchsia-600 dark:text-fuchsia-300 hover:bg-fuchsia-500/25 transition-colors"
          >
            Add token
          </button>
          <button onClick={dismissBanner} aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}
