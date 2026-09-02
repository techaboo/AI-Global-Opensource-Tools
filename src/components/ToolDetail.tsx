import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Star, GitFork, CircleDot, ExternalLink, Github, RefreshCw, Loader2, Flame, Clock } from 'lucide-react';
import type { AITool, Category, LiveRepoData } from '@/types';
import { formatStars, licenseColor, timeAgo } from '@/lib/format';
import { StatusBadge } from '@/components/ToolCard';
import { CategoryIcon } from '@/components/CategoryNav';

interface Props {
  tool: AITool | null;
  category?: Category;
  live?: LiveRepoData;
  onClose: () => void;
  onFetchLive: (t: AITool) => Promise<LiveRepoData | null>;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export function ToolDetail({ tool: toolProp, category, live, onClose, onFetchLive, isFavorite, onToggleFavorite }: Props) {
  const [fetching, setFetching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Reset the transient fetch-failure flag whenever a different tool opens,
  // derived during render (recommended over a setState-in-effect reset).
  const [lastToolId, setLastToolId] = useState<string | null>(null);
  const tool = toolProp;
  if (tool && tool.id !== lastToolId) {
    setLastToolId(tool.id);
    setFailed(false);
  }
  if (!tool) return null;
  const stars = live?.stars ?? tool.stars;

  const refresh = async () => {
    setFetching(true);
    setFailed(false);
    const res = await onFetchLive(tool);
    if (!res) setFailed(true);
    setFetching(false);
  };

  return (
    <Sheet open={!!tool} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tool.hot && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-500 px-2 py-0.5 text-[11px] font-semibold">
                <Flame className="h-3 w-3" />HOT
              </span>
            )}
            <StatusBadge status={tool.status} />
            {category && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${category.color}1c`, color: category.color }}>
                <CategoryIcon icon={category.icon} className="h-3 w-3" />{category.label}
              </span>
            )}
          </div>
          <SheetTitle className="text-2xl tracking-tight">{tool.name}</SheetTitle>
          <SheetDescription className="text-[14px]">{tool.tagline}</SheetDescription>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(tool.id)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-amber-500 transition-colors w-fit"
            >
              <Star className={`h-3.5 w-3.5 ${isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
              {isFavorite ? 'Saved to favorites' : 'Add to favorites'}
            </button>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{tool.desc}</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border p-3 text-center">
              <Star className="h-4 w-4 mx-auto mb-1 text-amber-400 fill-amber-400" />
              <div className="font-bold text-lg tabular-nums">{formatStars(stars)}</div>
              <div className="text-[10px] text-muted-foreground">{live ? 'Live stars' : 'Stars (snapshot)'}</div>
            </div>
            <div className="rounded-xl border border-border p-3 text-center">
              <GitFork className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="font-bold text-lg tabular-nums">{live ? formatStars(live.forks) : '—'}</div>
              <div className="text-[10px] text-muted-foreground">Forks</div>
            </div>
            <div className="rounded-xl border border-border p-3 text-center">
              <CircleDot className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="font-bold text-lg tabular-nums">{live ? formatStars(live.openIssues) : '—'}</div>
              <div className="text-[10px] text-muted-foreground">Open issues</div>
            </div>
          </div>

          {live?.pushedAt && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Last push {timeAgo(live.pushedAt)}
            </div>
          )}

          <div className="rounded-xl border border-border divide-y divide-border text-[13px]">
            {[
              ['Organization', tool.org],
              ['First released', `${tool.year}`],
              ['Primary language', tool.lang],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">License</span>
              <span className="font-medium" style={{ color: licenseColor(tool.license) }}>{tool.license}</span>
            </div>
            {tool.repo && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Repository</span>
                <span className="font-medium font-mono text-[12px]">{tool.repo}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {tool.tags.map(t => (
              <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">#{t}</span>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            {tool.repo && (
              <Button asChild className="flex-1 rounded-full gap-1.5">
                <a href={`https://github.com/${tool.repo}`} target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" /> Open on GitHub <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </Button>
            )}
            {tool.repo && (
              <Button variant="outline" onClick={refresh} disabled={fetching} className="rounded-full gap-1.5">
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {live ? 'Refresh' : 'Fetch live'}
              </Button>
            )}
          </div>
          {failed && <p className="text-[12px] text-rose-500">Live fetch failed (rate limit or repo moved). Snapshot data shown.</p>}
          {!tool.repo && (
            <p className="text-[12px] text-muted-foreground">No public repository tracked for this entry yet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
