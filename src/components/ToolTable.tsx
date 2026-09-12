import { List, type RowComponentProps } from 'react-window';
import { Star, Flame } from 'lucide-react';
import type { AITool, Category, LiveMap } from '@/types';
import { formatStars, licenseColor } from '@/lib/format';
import { resolveStarHistory } from '@/lib/starHistory';
import { StatusBadge } from '@/components/ToolCard';
import { CategoryIcon } from '@/components/CategoryNav';
import { ToolAvatar } from '@/components/ToolAvatar';
import { Sparkline } from '@/components/Sparkline';
import { cn } from '@/lib/utils';

interface Props {
  tools: AITool[];
  catMap: Map<string, Category>;
  liveMap: LiveMap;
  onOpen: (t: AITool) => void;
}

const ROW_H = 56;
const MAX_VISIBLE_ROWS = 12;

interface RowData {
  tools: AITool[];
  catMap: Map<string, Category>;
  liveMap: LiveMap;
  onOpen: (t: AITool) => void;
}

function Row({ ariaAttributes, index, style, tools, catMap, liveMap, onOpen }: RowComponentProps<RowData>) {
  const t = tools[index];
  const cat = catMap.get(t.cat);
  const live = liveMap[t.id];
  return (
    <div
      {...ariaAttributes}
      role="row"
      tabIndex={0}
      style={style}
      aria-label={`Open details for ${t.name}`}
      onClick={() => onOpen(t)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(t); } }}
      className={cn(
        'tool-table-grid grid items-center gap-3 border-b border-border px-3 cursor-pointer transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-fuchsia-500/40',
        index % 2 === 1 && 'bg-muted/10'
      )}
    >
      <div role="cell" className="text-muted-foreground tabular-nums text-[13px]">{index + 1}</div>
      <div role="cell" className="flex items-center gap-2 min-w-0 pr-2">
        <ToolAvatar repo={t.repo} categoryIcon={cat?.icon ?? 'box'} categoryColor={cat?.color} size={26} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[13px] truncate">{t.name}</span>
            {t.hot && <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{t.tagline}</div>
        </div>
      </div>
      <div role="cell" className="hidden whitespace-nowrap text-[12px] truncate sm:block">
        {cat && (
          <span className="inline-flex items-center gap-1.5" style={{ color: cat.color }}>
            <CategoryIcon icon={cat.icon} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{cat.label}</span>
          </span>
        )}
      </div>
      <div role="cell" className="hidden whitespace-nowrap text-[12px] truncate sm:block" style={{ color: licenseColor(t.license) }}>{t.license}</div>
      <div role="cell" className="hidden text-[12px] text-muted-foreground truncate sm:block">{t.lang}</div>
      <div role="cell" className="text-right tabular-nums whitespace-nowrap pr-2">
        <span className={cn('inline-flex items-center gap-1 font-semibold text-[13px]', live && 'text-emerald-500')}>
          <Star className={cn('h-3.5 w-3.5', live ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-400 text-amber-400')} />
          {formatStars(live?.stars ?? t.stars)}
        </span>
      </div>
      <div role="cell" className="hidden sm:block">
        <Sparkline points={resolveStarHistory(t, live).points} width={56} height={16} color={cat?.color ?? '#d946ef'} />
      </div>
      <div role="cell" className="hidden sm:block"><StatusBadge status={t.status} /></div>
    </div>
  );
}

export function ToolTable({ tools, catMap, liveMap, onOpen }: Props) {
  const height = Math.min(tools.length, MAX_VISIBLE_ROWS) * ROW_H;
  return (
    <div className="rounded-xl border border-border overflow-hidden" role="table" aria-label="AI tools" aria-rowcount={tools.length + 1}>
      <div
        role="row"
        className="tool-table-grid grid gap-3 bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground px-3 py-3"
      >
        <span role="columnheader" className="font-medium">#</span>
        <span role="columnheader" className="font-medium">Tool</span>
        <span role="columnheader" className="hidden font-medium sm:block">Category</span>
        <span role="columnheader" className="hidden font-medium sm:block">License</span>
        <span role="columnheader" className="hidden font-medium sm:block">Lang</span>
        <span role="columnheader" className="font-medium text-right">Stars</span>
        <span role="columnheader" className="hidden font-medium sm:block">Trend</span>
        <span role="columnheader" className="hidden font-medium sm:block">Status</span>
      </div>
      <List
        role="rowgroup"
        aria-label="Tool rows"
        rowComponent={Row}
        rowCount={tools.length}
        rowHeight={ROW_H}
        rowProps={{ tools, catMap, liveMap, onOpen }}
        style={{ height }}
      />
    </div>
  );
}
