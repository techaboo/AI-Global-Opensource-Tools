import { useState } from 'react';
import { Moon, Sun, Search, RefreshCw, Radar, Loader2, Key, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  token: string;
  onSaveToken: (t: string) => void;
  onlyFav: boolean;
  onToggleFav: () => void;
  favCount: number;
}

export function Header({ dark, onToggleDark, search, onSearch, syncing, progress, rateLimited, syncedCount, lastSync, onSync, token, onSaveToken, onlyFav, onToggleFav, favCount }: Props) {
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(token);

  const save = () => {
    onSaveToken(tokenDraft.trim());
    setTokenOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-fuchsia-500/20">
            <Radar className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-bold text-[15px] tracking-tight">Open Source AI Atlas</div>
            <div className="text-[11px] text-muted-foreground">The living map of open AI — 234 tools, 24 categories</div>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search tools, orgs, tags, licenses…  ( / )"
              className="w-full h-10 rounded-full border border-border bg-muted/50 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/50 transition placeholder:text-muted-foreground/70"
            />
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
                  ? 'GitHub rate limit hit — add a token for 5,000 req/hr'
                  : syncedCount > 0
                    ? `${syncedCount} live · ${lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                    : 'Snapshot data · sync for live stars'}
              </span>
            )}
          </div>

          {/* GitHub token button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setTokenDraft(token); setTokenOpen(o => !o); }}
              className={cn('rounded-full', token && 'text-emerald-500')}
              aria-label="GitHub token settings"
              title={token ? 'GitHub token saved (5,000 req/hr)' : 'Add GitHub token for 5,000 req/hr'}
            >
              <Key className="h-4 w-4" />
            </Button>
            {tokenOpen && (
              <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-card p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">GitHub Token</div>
                  <button onClick={() => setTokenOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                  Optional. Raises the rate limit from 60 to 5,000 req/hr and lets you sync the whole catalog at once.
                  Stored only in your browser's localStorage. Create one at{' '}
                  <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" className="text-fuchsia-500 hover:underline">
                    github.com/settings/tokens
                  </a>{' '}
                  (read-only public access is enough).
                </p>
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={e => setTokenDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); }}
                  placeholder="github_pat_… or ghp_…"
                  className="w-full h-9 rounded-lg border border-border bg-muted/50 px-3 text-[12px] font-mono outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
                <div className="flex gap-2 justify-end">
                  {token && (
                    <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => { onSaveToken(''); setTokenDraft(''); }}>
                      Remove
                    </Button>
                  )}
                  <Button size="sm" className="h-8 text-[12px] rounded-full" onClick={save}>Save</Button>
                </div>
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

          <Button variant="outline" size="sm" onClick={onSync} disabled={syncing} className="rounded-full gap-1.5">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{syncing ? 'Syncing' : 'Sync GitHub'}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleDark} className="rounded-full" aria-label="Toggle theme">
            {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}