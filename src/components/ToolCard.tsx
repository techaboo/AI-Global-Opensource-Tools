import { Star, Flame, GitFork, PauseCircle, Archive, TriangleAlert } from 'lucide-react';
import type { AITool, Category, LiveRepoData } from '@/types';
import { formatStars, isStale, licenseColor } from '@/lib/format';
import { resolveStarHistory } from '@/lib/starHistory';
import { Sparkline } from '@/components/Sparkline';
import { ToolAvatar } from '@/components/ToolAvatar';
import { cn } from '@/lib/utils';

interface Props {
  tool: AITool;
  category?: Category;
  live?: LiveRepoData;
  onOpen: (t: AITool) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  /** Stagger index for the entrance animation; only the first screen's worth is staggered. */
  animIndex?: number;
}

export function StatusBadge({ status, className }: { status: AITool['status']; className?: string }) {
  if (status === 'active') return null;
  const conf = status === 'maintenance'
    ? { icon: PauseCircle, label: 'Maintenance', cls: 'text-amber-700 dark:text-amber-300 border-amber-500/50 bg-amber-500/10' }
    : { icon: Archive, label: 'Archived', cls: 'text-rose-700 dark:text-rose-300 border-rose-500/50 bg-rose-500/10' };
  const Icon = conf.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', conf.cls, className)}>
      <Icon className="h-3 w-3" />{conf.label}
    </span>
  );
}

/** Shown only when a *successful* live fetch confirms no push in over a year despite `status: active`. */
export function StaleBadge({ tool, live, className }: { tool: AITool; live?: LiveRepoData; className?: string }) {
  if (tool.status !== 'active' || !isStale(live?.pushedAt)) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 border-amber-500/50 bg-amber-500/10', className)}
      title="No push in over a year despite being recorded as active — may need an editorial check"
    >
      <TriangleAlert className="h-3 w-3" />Stale?
    </span>
  );
}

export function ToolCard({ tool, category, live, onOpen, isFavorite, onToggleFavorite, animIndex }: Props) {
  const stars = live?.stars ?? tool.stars;
  const { points, source } = resolveStarHistory(tool, live);
  const staggerMs = animIndex !== undefined && animIndex < 18 ? animIndex * 25 : 0;
  return (
    <article
      style={staggerMs ? { animationDelay: `${staggerMs}ms` } : undefined}
      className={cn(
        'group relative text-left rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:border-border/80 focus-within:ring-2 focus-within:ring-fuchsia-500/40 overflow-hidden [content-visibility:auto] [contain-intrinsic-size:auto_180px]',
        animIndex !== undefined && 'animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both'
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-70 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${category?.color ?? '#8b5cf6'}, transparent)` }}
      />
      <button
        type="button"
        aria-label={`Open details for ${tool.name}`}
        onClick={() => onOpen(tool)}
        className="absolute inset-0 z-0 rounded-xl"
      />
      {onToggleFavorite && (
        <button
          type="button"
          aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(tool.id); }}
          className={`pointer-events-auto absolute top-2.5 right-2.5 z-10 rounded-full p-1 transition-all ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'} hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40`}
        >
          <Star className={`h-4 w-4 transition-colors ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground hover:text-amber-400'}`} />
        </button>
      )}
      <div className="pointer-events-none relative z-[1]">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex items-start gap-2">
          <ToolAvatar repo={tool.repo} categoryIcon={category?.icon ?? 'box'} categoryColor={category?.color} size={28} className="mt-0.5" />
          <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-[14px] truncate group-hover:text-fuchsia-500 transition-colors">{tool.name}</span>
            {tool.hot && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 text-[10px] font-semibold">
                <Flame className="h-3 w-3" />HOT
              </span>
            )}
            <StatusBadge status={tool.status} />
            <StaleBadge tool={tool} live={live} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{tool.org} · {tool.year}</div>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums">
            <Star className={cn('h-3.5 w-3.5', live ? 'text-emerald-500 fill-emerald-500' : 'text-amber-400 fill-amber-400')} />
            {formatStars(stars)}
          </span>
          <Sparkline
            points={points}
            width={64}
            height={16}
            color={category?.color ?? '#d946ef'}
            className="mt-0.5 opacity-80"
            title={source === 'live' ? 'Star history (weekly snapshot)' : 'Approximate star history'}
          />
          {live && <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-medium">LIVE</span>}
        </div>
      </div>
      <p className="text-[12.5px] text-muted-foreground leading-snug line-clamp-2 mb-3">{tool.tagline}. {tool.desc}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {category && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-foreground"
            style={{ background: `${category.color}1c`, borderColor: `${category.color}66` }}
          >
            {category.label}
          </span>
        )}
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-foreground"
          style={{ borderColor: `${licenseColor(tool.license)}66`, background: `${licenseColor(tool.license)}14` }}
        >
          {tool.license}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-foreground">{tool.lang}</span>
        {live && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <GitFork className="h-3 w-3" />{formatStars(live.forks)}
          </span>
        )}
      </div>
      </div>
    </article>
  );
}
