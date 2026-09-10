import * as Lucide from 'lucide-react';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const ICONS: Record<string, Lucide.LucideIcon> = {
  'brain': Lucide.Brain,
  'scan-eye': Lucide.ScanEye,
  'server': Lucide.Server,
  'message-square': Lucide.MessageSquare,
  'bot': Lucide.Bot,
  'code-2': Lucide.Code2,
  'sparkles': Lucide.Sparkles,
  'mouse-pointer-click': Lucide.MousePointerClick,
  'book-open': Lucide.BookOpen,
  'database': Lucide.Database,
  'workflow': Lucide.Workflow,
  'image': Lucide.Image,
  'clapperboard': Lucide.Clapperboard,
  'audio-lines': Lucide.AudioLines,
  'dumbbell': Lucide.Dumbbell,
  'layers': Lucide.Layers,
  'rocket': Lucide.Rocket,
  'line-chart': Lucide.LineChart,
  'shield-check': Lucide.ShieldCheck,
  'tags': Lucide.Tags,
  'eye': Lucide.Eye,
  'file-text': Lucide.FileText,
  'plug-zap': Lucide.PlugZap,
  'cpu': Lucide.Cpu,
  'layout-grid': Lucide.LayoutGrid,
  'globe': Lucide.Globe,
  'box': Lucide.Box,
  'library-big': Lucide.LibraryBig,
};

export function CategoryIcon({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICONS[icon] ?? Lucide.Box;
  return <Icon className={className} style={style} />;
}

interface Props {
  categories: Category[];
  counts: Record<string, number>;
  total: number;
  active: string;
  onSelect: (id: string) => void;
}

export function CategoryNav({ categories, counts, total, active, onSelect }: Props) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-border h-[calc(100vh-4rem)] sticky top-16">
      <ScrollArea className="h-full py-4 pr-3 pl-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">Categories</div>
        <button
          onClick={() => onSelect('all')}
          aria-current={active === 'all' ? 'true' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors mb-1',
            active === 'all' ? 'bg-fuchsia-500/15 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <CategoryIcon icon="layout-grid" className="h-4 w-4 text-fuchsia-500" />
          <span className="flex-1 min-w-0 text-left">All tools</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{total}</span>
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            aria-current={active === c.id ? 'true' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
              active === c.id ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            style={active === c.id ? { background: `${c.color}22` } : undefined}
          >
            <CategoryIcon icon={c.icon} className="h-4 w-4 shrink-0" style={{ color: c.color }} />
            <span className="flex-1 min-w-0 text-left truncate">{c.label}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{counts[c.id] ?? 0}</span>
          </button>
        ))}
        <div className="mt-6 px-2 text-[11px] text-muted-foreground leading-relaxed">
          Star counts are a curated research snapshot. Hit <span className="font-medium text-foreground">Sync GitHub</span> to refresh live data for the visible list.
        </div>
      </ScrollArea>
    </aside>
  );
}
