import { ArrowDownWideNarrow, LayoutGrid, Table2, BarChart3, GitCompare, X, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_LICENSES, ALL_LANGUAGES } from '@/data/tools';
import { cn } from '@/lib/utils';

export type SortKey = 'stars' | 'name' | 'year' | 'category' | 'pushed';
export type ViewMode = 'grid' | 'table' | 'analytics' | 'compare';
export type ExportFormat = 'csv' | 'json';

interface Props {
  sort: SortKey;
  onSort: (s: SortKey) => void;
  license: string;
  onLicense: (v: string) => void;
  lang: string;
  onLang: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  count: number;
  total: number;
  onClear: () => void;
  hasFilters: boolean;
  onExport?: (format: ExportFormat) => void;
}

const VIEW_BTNS: { key: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { key: 'grid', icon: LayoutGrid, label: 'Grid' },
  { key: 'table', icon: Table2, label: 'Table' },
  { key: 'analytics', icon: BarChart3, label: 'Analytics' },
  { key: 'compare', icon: GitCompare, label: 'Compare' },
];

export function FilterBar(p: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5">
        {VIEW_BTNS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => p.onView(key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
              p.view === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <Select value={p.sort} onValueChange={v => p.onSort(v as SortKey)}>
        <SelectTrigger className="h-9 w-[130px] rounded-full text-[12px]">
          <ArrowDownWideNarrow className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="stars">Most stars</SelectItem>
          <SelectItem value="pushed">Recently pushed</SelectItem>
          <SelectItem value="name">Name A–Z</SelectItem>
          <SelectItem value="year">Newest</SelectItem>
          <SelectItem value="category">Category</SelectItem>
        </SelectContent>
      </Select>

      <Select value={p.license} onValueChange={p.onLicense}>
        <SelectTrigger className="h-9 w-[150px] rounded-full text-[12px]"><SelectValue placeholder="License" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All licenses</SelectItem>
          {ALL_LICENSES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={p.lang} onValueChange={p.onLang}>
        <SelectTrigger className="h-9 w-[140px] rounded-full text-[12px]"><SelectValue placeholder="Language" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All languages</SelectItem>
          {ALL_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={p.status} onValueChange={p.onStatus}>
        <SelectTrigger className="h-9 w-[140px] rounded-full text-[12px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="maintenance">Maintenance</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      <span className="text-[12px] text-muted-foreground ml-auto tabular-nums">
        {p.count} / {p.total} tools
      </span>
      {p.onExport && (
        <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-0.5">
          <span className="inline-flex items-center gap-1 px-2 text-[11px] text-muted-foreground">
            <Download className="h-3 w-3" />Export
          </span>
          <button
            onClick={() => p.onExport?.('csv')}
            disabled={p.count === 0}
            className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            CSV
          </button>
          <button
            onClick={() => p.onExport?.('json')}
            disabled={p.count === 0}
            className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            JSON
          </button>
        </div>
      )}
      {p.hasFilters && (
        <button onClick={p.onClear} className="inline-flex items-center gap-1 text-[12px] text-fuchsia-500 hover:text-fuchsia-400 font-medium">
          <X className="h-3.5 w-3.5" />Reset
        </button>
      )}
    </div>
  );
}
