import { Star, Flame } from 'lucide-react';
import type { AITool, Category, LiveMap } from '@/types';
import { formatStars, licenseColor } from '@/lib/format';
import { resolveStarHistory } from '@/lib/starHistory';
import { StatusBadge } from '@/components/ToolCard';
import { CategoryIcon } from '@/components/CategoryNav';
import { Sparkline } from '@/components/Sparkline';
import { cn } from '@/lib/utils';

interface Props {
  tools: AITool[];
  catMap: Map<string, Category>;
  liveMap: LiveMap;
  onOpen: (t: AITool) => void;
}

export function ToolTable({ tools, catMap, liveMap, onOpen }: Props) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Tool</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">License</th>
              <th className="px-4 py-3 font-medium">Lang</th>
              <th className="px-4 py-3 font-medium text-right">Stars</th>
              <th className="px-4 py-3 font-medium">Trend</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tools.map((t, i) => {
              const cat = catMap.get(t.cat);
              const live = liveMap[t.id];
              return (
                <tr key={t.id} onClick={() => onOpen(t)} className="hover:bg-muted/40 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{t.name}</span>
                      {t.hot && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[320px]">{t.tagline}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {cat && (
                      <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: cat.color }}>
                        <CategoryIcon icon={cat.icon} className="h-3.5 w-3.5" />{cat.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-[12px]" style={{ color: licenseColor(t.license) }}>{t.license}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{t.lang}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                    <span className={cn('inline-flex items-center gap-1 font-semibold', live && 'text-emerald-500')}>
                      <Star className={cn('h-3.5 w-3.5', live ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-400 text-amber-400')} />
                      {formatStars(live?.stars ?? t.stars)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Sparkline
                      points={resolveStarHistory(t, live).points}
                      width={56}
                      height={16}
                      color={cat?.color ?? '#d946ef'}
                    />
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
