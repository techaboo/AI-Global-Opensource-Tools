import { Star, Flame, GitFork, AlertCircle, PauseCircle, Archive } from 'lucide-react';
import type { AITool, Category, LiveRepoData } from '@/types';
import { formatStars, licenseColor } from '@/lib/format';
import { resolveStarHistory } from '@/lib/starHistory';
import { Sparkline } from '@/components/Sparkline';
import { cn } from '@/lib/utils';

interface Props {
  tool: AITool;
  category?: Category;
  live?: LiveRepoData;
  onOpen: (t: AITool) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export function StatusBadge({ status, className }: { status: AITool['status']; className?: string }) {
  if (status === 'active') return null;
  const conf = status === 'maintenance'
    ? { icon: PauseCircle, label: 'Maintenance', cls: 'text-amber-500 border-amber-500/40 bg-amber-500/10' }
    : { icon: Archive, label: 'Archived', cls: 'text-rose-500 border-rose-500/40 bg-rose-500/10' };
  const Icon = conf.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', conf.cls, className)}>
      <Icon className="h-3 w-3" />{conf.label}
    </span>
  );
}

export function ToolCard({ tool, category, live, onOpen, isFavorite, onToggleFavorite }: Props) {
  const stars = live?.stars ?? tool.stars;
  const { points, source } = resolveStarHistory(tool, live);
  return (
    <button
      onClick={() => onOpen(tool)}
      className="group relative text-left rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 overflow-hidden"
    >
      <div
        className="absolute inset-x-0 top-0 h-0.5 opacity-70 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${category?.color ?? '#8b5cf6'}, transparent)` }}
      />
      {onToggleFavorite && (
        <span
          role="button"
          tabIndex={0}
          aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(tool.id); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleFavorite(tool.id); } }}
          className={`absolute top-2.5 right-2.5 z-10 rounded-full p-1 transition-all ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'} hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40`}
        >
          <Star className={`h-4 w-4 transition-colors ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground hover:text-amber-400'}`} />
        </span>
      )}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-[14px] truncate group-hover:text-fuchsia-500 transition-colors">{tool.name}</span>
            {tool.hot && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-500 px-1.5 py-0.5 text-[10px] font-semibold">
                <Flame className="h-3 w-3" />HOT
              </span>
            )}
            <StatusBadge status={tool.status} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{tool.org} · {tool.year}</div>
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
          {live && <span className="text-[9px] text-emerald-500 font-medium">LIVE</span>}
        </div>
      </div>
      <p className="text-[12.5px] text-muted-foreground leading-snug line-clamp-2 mb-3">{tool.tagline}. {tool.desc}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {category && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: `${category.color}1c`, color: category.color }}
          >
            {category.label}
          </span>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium border"
          style={{ borderColor: `${licenseColor(tool.license)}55`, color: licenseColor(tool.license) }}
        >
          {tool.license}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">{tool.lang}</span>
        {live && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <GitFork className="h-3 w-3" />{formatStars(live.forks)}
          </span>
        )}
        {tool.status !== 'active' && <AlertCircle className="hidden" />}
      </div>
    </button>
  );
}
