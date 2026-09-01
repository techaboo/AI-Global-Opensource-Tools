import { useState } from 'react';
import { Moon, Sun, Search, RefreshCw, Radar, Loader2, KeyRound, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
}

export function Header({ dark, onToggleDark, search, onSearch, syncing, progress, rateLimited, syncedCount, lastSync, onSync, hasToken, onSetToken }: Props) {
  const [tokenOpen, setTokenOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  const saveToken = () => {
    onSetToken(draft);
    setDraft('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
            <div className="text-[11px] text-muted-foreground">The living map of open AI — 292 tools, 27 categories</div>
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
                  <input
                    type="password"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveToken()}
                    placeholder={hasToken ? '••••••••••  (token saved)' : 'github_pat_… or ghp_…'}
                    className="flex-1 h-9 rounded-lg border border-border bg-muted/50 px-3 text-xs outline-none focus:ring-2 focus:ring-fuchsia-500/40 font-mono"
                  />
                  <Button size="sm" onClick={saveToken} disabled={!draft.trim()} className="rounded-lg h-9">
                    {saved ? <Check className="h-3.5 w-3.5" /> : 'Save'}
                  </Button>
                </div>
                {hasToken && (
                  <button
                    onClick={() => { onSetToken(''); setTokenOpen(false); }}
                    className="mt-2 text-[11px] text-rose-500 hover:text-rose-400"
                  >
                    Remove saved token
                  </button>
                )}
              </div>
            )}
          </div>

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
