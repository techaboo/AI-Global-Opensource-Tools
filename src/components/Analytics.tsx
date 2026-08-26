import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import type { AITool, LiveMap } from '@/types';
import { formatStars } from '@/lib/format';
import { CATEGORIES } from '@/data/tools';

interface Props {
  tools: AITool[];
  liveMap: LiveMap;
  onSelectCategory: (id: string) => void;
}

const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16', '#64748b'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
} as const;

export function Analytics({ tools, liveMap, onSelectCategory }: Props) {
  const starsOf = (t: AITool) => liveMap[t.id]?.stars ?? t.stars;

  const byCategory = useMemo(() => {
    const m = new Map<string, { count: number; stars: number }>();
    for (const t of tools) {
      const e = m.get(t.cat) ?? { count: 0, stars: 0 };
      e.count += 1; e.stars += starsOf(t);
      m.set(t.cat, e);
    }
    return CATEGORIES.map(c => ({
      name: c.label.length > 16 ? c.label.slice(0, 15) + '…' : c.label,
      full: c.label, id: c.id, color: c.color,
      tools: m.get(c.id)?.count ?? 0,
      stars: m.get(c.id)?.stars ?? 0,
    })).sort((a, b) => b.tools - a.tools);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, liveMap]);

  const topStarred = useMemo(() =>
    [...tools].sort((a, b) => starsOf(b) - starsOf(a)).slice(0, 12).map(t => ({
      name: t.name.length > 14 ? t.name.slice(0, 13) + '…' : t.name,
      stars: starsOf(t),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tools, liveMap]);

  const byLicense = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tools) {
      const key = t.license.split(' ')[0].replace('(Apache-based)', 'Custom');
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [tools]);

  const byStatus = useMemo(() => {
    const m = { active: 0, maintenance: 0, archived: 0 } as Record<string, number>;
    for (const t of tools) m[t.status] += 1;
    return [
      { name: 'Active', value: m.active, color: '#10b981' },
      { name: 'Maintenance', value: m.maintenance, color: '#f59e0b' },
      { name: 'Archived', value: m.archived, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [tools]);

  const byLang = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tools) m.set(t.lang, (m.get(t.lang) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [tools]);

  const byYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of tools) m.set(t.year, (m.get(t.year) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year: `${year}`, count }));
  }, [tools]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartCard title="Tools per category" subtitle="Click a bar to filter" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byCategory} margin={{ left: -18, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-28} textAnchor="end" height={64} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, item) => [`${v} tools`, (item?.payload as { full: string }).full]} />
            <Bar dataKey="tools" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => { const p = d as unknown as { id?: string }; if (p?.id) onSelectCategory(p.id); }}>
              {byCategory.map(c => <Cell key={c.id} fill={c.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top 12 by GitHub stars" subtitle="Uses live data when synced">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={topStarred} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatStars} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatStars(v), 'Stars']} />
            <Bar dataKey="stars" fill="#d946ef" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChartCard title="License mix">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={byLicense} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                {byLicense.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <Legend items={byLicense.map((d, i) => ({ label: `${d.name} (${d.value})`, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
        </ChartCard>

        <ChartCard title="Project health">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                {byStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <Legend items={byStatus.map(d => ({ label: `${d.name} (${d.value})`, color: d.color }))} />
        </ChartCard>
      </div>

      <ChartCard title="Primary language">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byLang} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#06b6d4" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="First-release year" subtitle="When tools in the catalog debuted">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byYear} margin={{ left: -18, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className ?? ''}`}>
      <div className="mb-3">
        <div className="font-semibold text-[14px]">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}
