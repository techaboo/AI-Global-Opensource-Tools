import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend as RechartsLegend,
} from 'recharts';
import { GitCompare, Plus, X } from 'lucide-react';
import type { AITool, Category, LiveMap } from '@/types';
import { CATEGORIES } from '@/data/tools';
import { formatStars } from '@/lib/format';
import { MAX_COMPARE, dedupeIds } from '@/lib/compare';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategoryIcon } from '@/components/CategoryNav';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
} as const;

interface Props {
  tools: AITool[];
  liveMap: LiveMap;
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
  onOpenTool: (t: AITool) => void;
}

function mixKey(license: string) {
  return license.split(' ')[0].replace('(Apache-based)', 'Custom');
}

function summarize(tools: AITool[], liveMap: LiveMap) {
  const starsOf = (t: AITool) => liveMap[t.id]?.stars ?? t.stars;
  const licenses = new Map<string, number>();
  const langs = new Map<string, number>();
  const health = { active: 0, maintenance: 0, archived: 0 };
  let stars = 0;
  for (const t of tools) {
    stars += starsOf(t);
    licenses.set(mixKey(t.license), (licenses.get(mixKey(t.license)) ?? 0) + 1);
    langs.set(t.lang, (langs.get(t.lang) ?? 0) + 1);
    health[t.status] += 1;
  }
  const top = [...tools].sort((a, b) => starsOf(b) - starsOf(a)).slice(0, 5);
  const activePct = tools.length ? Math.round((health.active / tools.length) * 100) : 0;
  return { count: tools.length, stars, licenses, langs, health, top, activePct, starsOf };
}

export function CompareView({ tools, liveMap, selectedIds, onChangeIds, onOpenTool }: Props) {
  const catMap = useMemo(() => new Map(CATEGORIES.map(c => [c.id, c])), []);
  const ids = selectedIds.slice(0, MAX_COMPARE);

  const columns = useMemo(() => {
    return ids.map(id => {
      const cat = catMap.get(id);
      const list = tools.filter(t => t.cat === id);
      return { id, cat, list, stats: summarize(list, liveMap) };
    });
  }, [ids, tools, liveMap, catMap]);

  const groupedLicense = useMemo(() => {
    const keys = new Set<string>();
    for (const col of columns) for (const k of col.stats.licenses.keys()) keys.add(k);
    return [...keys].map(name => {
      const row: Record<string, string | number> = { name };
      for (const col of columns) row[col.id] = col.stats.licenses.get(name) ?? 0;
      return row;
    }).sort((a, b) => {
      const sum = (r: Record<string, string | number>) =>
        columns.reduce((s, c) => s + (Number(r[c.id]) || 0), 0);
      return sum(b) - sum(a);
    }).slice(0, 8);
  }, [columns]);

  const groupedLang = useMemo(() => {
    const keys = new Set<string>();
    for (const col of columns) for (const k of col.stats.langs.keys()) keys.add(k);
    return [...keys].map(name => {
      const row: Record<string, string | number> = { name };
      for (const col of columns) row[col.id] = col.stats.langs.get(name) ?? 0;
      return row;
    }).sort((a, b) => {
      const sum = (r: Record<string, string | number>) =>
        columns.reduce((s, c) => s + (Number(r[c.id]) || 0), 0);
      return sum(b) - sum(a);
    }).slice(0, 8);
  }, [columns]);

  const groupedHealth = useMemo(() => {
    return (['active', 'maintenance', 'archived'] as const).map(status => {
      const row: Record<string, string | number> = { name: status[0].toUpperCase() + status.slice(1) };
      for (const col of columns) row[col.id] = col.stats.health[status];
      return row;
    });
  }, [columns]);

  const setSlot = (index: number, nextId: string) => {
    const next = [...ids];
    next[index] = nextId;
    onChangeIds(dedupeIds(next));
  };

  const addSlot = () => {
    const used = new Set(ids);
    const pick = CATEGORIES.find(c => !used.has(c.id));
    if (pick) onChangeIds([...ids, pick.id]);
  };

  const removeSlot = (index: number) => {
    if (ids.length <= 2) return;
    onChangeIds(ids.filter((_, i) => i !== index));
  };

  const unused = CATEGORIES.filter(c => !ids.includes(c.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <GitCompare className="h-3.5 w-3.5" /> Compare
        </span>
        {ids.map((id, i) => (
          <div key={`${id}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-[11px] text-muted-foreground px-0.5">vs</span>}
            <Select value={id} onValueChange={v => setSlot(i, v)}>
              <SelectTrigger className="h-9 w-[200px] rounded-full text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.id} value={c.id} disabled={ids.includes(c.id) && c.id !== id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ids.length > 2 && (
              <button
                onClick={() => removeSlot(i)}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label="Remove category"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {ids.length < MAX_COMPARE && unused.length > 0 && (
          <button
            onClick={addSlot}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        )}
      </div>

      <div className={cn('grid gap-3', ids.length === 3 ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
        {columns.map(col => (
          <CategoryColumn key={col.id} col={col} onOpenTool={onOpenTool} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="License mix" subtitle="Tools per license family">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={groupedLicense} margin={{ left: -8, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-20} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <RechartsLegend wrapperStyle={{ fontSize: 11 }} />
              {columns.map(col => (
                <Bar key={col.id} dataKey={col.id} name={col.cat?.label ?? col.id} fill={col.cat?.color ?? '#8b5cf6'} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Language mix" subtitle="Primary language">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={groupedLang} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <RechartsLegend wrapperStyle={{ fontSize: 11 }} />
              {columns.map(col => (
                <Bar key={col.id} dataKey={col.id} name={col.cat?.label ?? col.id} fill={col.cat?.color ?? '#8b5cf6'} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Project health" subtitle="Active / maintenance / archived" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={groupedHealth} margin={{ left: -8, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <RechartsLegend wrapperStyle={{ fontSize: 11 }} />
              {columns.map(col => (
                <Bar key={col.id} dataKey={col.id} name={col.cat?.label ?? col.id} fill={col.cat?.color ?? '#8b5cf6'} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function CategoryColumn({
  col,
  onOpenTool,
}: {
  col: { id: string; cat?: Category; list: AITool[]; stats: ReturnType<typeof summarize> };
  onOpenTool: (t: AITool) => void;
}) {
  const { cat, stats } = col;
  const licensePie = [...stats.licenses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name, value }));
  const healthPie = [
    { name: 'Active', value: stats.health.active, color: '#10b981' },
    { name: 'Maintenance', value: stats.health.maintenance, color: '#f59e0b' },
    { name: 'Archived', value: stats.health.archived, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-2">
        {cat && <CategoryIcon icon={cat.icon} className="h-5 w-5 mt-0.5" style={{ color: cat.color }} />}
        <div className="min-w-0">
          <div className="font-semibold text-[14px] truncate">{cat?.label ?? col.id}</div>
          <div className="text-[11px] text-muted-foreground line-clamp-2">{cat?.blurb}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <StatCell label="Tools" value={`${stats.count}`} />
        <StatCell label="Stars" value={formatStars(stats.stars)} />
        <StatCell label="Active" value={`${stats.activePct}%`} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniPie title="Licenses" data={licensePie} colors={PIE_COLORS} />
        <MiniPie title="Health" data={healthPie} />
      </div>

      <div>
        <div className="text-[11px] font-medium text-muted-foreground mb-1.5">Top tools by stars</div>
        <ul className="space-y-1">
          {stats.top.map((t, i) => (
            <li key={t.id}>
              <button
                onClick={() => onOpenTool(t)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
              >
                <span className="text-[11px] tabular-nums text-muted-foreground w-4">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{t.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{formatStars(stats.starsOf(t))}</span>
              </button>
            </li>
          ))}
          {stats.top.length === 0 && (
            <li className="text-[12px] text-muted-foreground px-2 py-2">No tools in this slice.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2 py-2">
      <div className="font-bold text-[15px] tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function MiniPie({
  title,
  data,
  colors,
}: {
  title: string;
  data: { name: string; value: number; color?: string }[];
  colors?: string[];
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground mb-1">{title}</div>
      {data.length === 0 ? (
        <div className="h-[120px] text-[11px] text-muted-foreground flex items-center justify-center">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? colors?.[i % (colors?.length ?? 1)] ?? '#8b5cf6'} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="mb-3">
        <div className="font-semibold text-[14px]">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

