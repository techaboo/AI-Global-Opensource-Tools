import { useEffect, useState } from 'react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from 'cmdk';
import { LayoutGrid, Table2, BarChart3, GitCompare, Moon, Sun, Star, RefreshCw, X, Search } from 'lucide-react';
import type { AITool, Category } from '@/types';
import type { ViewMode } from '@/components/FilterBar';
import { CategoryIcon } from '@/components/CategoryNav';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: AITool[];
  categories: Category[];
  onOpenTool: (t: AITool) => void;
  onSelectCategory: (id: string) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  dark: boolean;
  onToggleDark: () => void;
  onlyFav: boolean;
  onToggleFav: () => void;
  onSync: () => void;
  onClearFilters: () => void;
}

const VIEWS: { key: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
  { key: 'table', icon: Table2, label: 'Table view' },
  { key: 'analytics', icon: BarChart3, label: 'Analytics view' },
  { key: 'compare', icon: GitCompare, label: 'Compare view' },
];

export function CommandPalette({
  open, onOpenChange, tools, categories, onOpenTool, onSelectCategory,
  view, onView, dark, onToggleDark, onlyFav, onToggleFav, onSync, onClearFilters,
}: Props) {
  const [search, setSearch] = useState('');
  // Reset the search box when the palette closes, derived during render
  // (recommended over a setState-in-effect reset — see ToolDetail.tsx for the same pattern).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setSearch('');
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed left-1/2 top-24 z-[60] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
      shouldFilter
    >
      <Command className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search tools, jump to a view, toggle theme…"
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => onOpenChange(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <CommandList className="max-h-96 overflow-y-auto p-1.5">
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No results found.</CommandEmpty>

          <CommandGroup heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandItem onSelect={() => run(onToggleDark)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Toggle {dark ? 'light' : 'dark'} theme
            </CommandItem>
            <CommandItem onSelect={() => run(onToggleFav)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
              <Star className={onlyFav ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4'} />
              {onlyFav ? 'Show all tools' : 'Show favorites only'}
            </CommandItem>
            <CommandItem onSelect={() => run(onSync)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
              <RefreshCw className="h-4 w-4" /> Sync GitHub stats
            </CommandItem>
            <CommandItem onSelect={() => run(onClearFilters)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
              <X className="h-4 w-4" /> Reset all filters
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="my-1 h-px bg-border" />

          <CommandGroup heading="Views" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            {VIEWS.map(({ key, icon: Icon, label }) => (
              <CommandItem key={key} onSelect={() => run(() => onView(key))} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
                <Icon className="h-4 w-4" /> {label}{view === key ? ' (current)' : ''}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator className="my-1 h-px bg-border" />

          <CommandGroup heading="Categories" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            {categories.map(c => (
              <CommandItem key={c.id} onSelect={() => run(() => onSelectCategory(c.id))} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
                <CategoryIcon icon={c.icon} className="h-4 w-4" style={{ color: c.color }} /> {c.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator className="my-1 h-px bg-border" />

          <CommandGroup heading="Tools" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            {tools.map(t => (
              <CommandItem key={t.id} value={`${t.name} ${t.org} ${t.tagline}`} onSelect={() => run(() => onOpenTool(t))} className="flex flex-col items-start gap-0 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-muted">
                <span className="font-medium">{t.name}</span>
                <span className="text-[11px] text-muted-foreground truncate w-full">{t.tagline}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
