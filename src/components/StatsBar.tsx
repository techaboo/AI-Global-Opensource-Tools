import { Boxes, Layers, Star, Flame, Activity, Radio } from 'lucide-react';
import { useMemo } from 'react';
import type { AITool, LiveMap } from '@/types';
import { formatStars } from '@/lib/format';

export function StatsBar({ tools, liveMap, syncedCount }: { tools: AITool[]; liveMap: LiveMap; syncedCount: number }) {
  const stats = useMemo(() => {
    const totalStars = tools.reduce((s, t) => s + (liveMap[t.id]?.stars ?? t.stars), 0);
    const cats = new Set(tools.map(t => t.cat)).size;
    const hot = tools.filter(t => t.hot).length;
    const active = tools.filter(t => t.status === 'active').length;
    return { total: tools.length, cats, totalStars, hot, active };
  }, [tools, liveMap]);

  const activePercent = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const items = [
    { icon: Boxes, label: 'Tools tracked', value: `${stats.total}`, color: '#8b5cf6' },
    { icon: Layers, label: 'Categories', value: `${stats.cats}`, color: '#06b6d4' },
    { icon: Star, label: 'Combined stars', value: formatStars(stats.totalStars), color: '#f59e0b' },
    { icon: Flame, label: 'Trending now', value: `${stats.hot}`, color: '#ef4444' },
    { icon: Activity, label: 'Active projects', value: `${activePercent}%`, color: '#10b981' },
    { icon: Radio, label: 'Live-synced', value: `${syncedCount}`, color: '#ec4899' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1c` }}>
            <Icon className="h-4.5 w-4.5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
            <div className="text-[10.5px] text-muted-foreground truncate">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
