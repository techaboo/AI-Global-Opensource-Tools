import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AITool } from '@/types';
import { Button } from '@/components/ui/button';

export const GRID_PAGE_SIZE = 60;

/**
 * Card grid that mounts one page at a time, so the page stays fast as the catalog
 * grows. The next page loads when the button scrolls into view, or on click.
 */
export function ToolGrid({ tools, renderTool }: { tools: AITool[]; renderTool: (tool: AITool, index: number) => ReactNode }) {
  const [limit, setLimit] = useState(GRID_PAGE_SIZE);
  const more = useRef<HTMLDivElement>(null);
  const remaining = Math.max(tools.length - limit, 0);

  useEffect(() => {
    const node = more.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setLimit(n => n + GRID_PAGE_SIZE); },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // Re-observe after each page: an observer only reports changes in visibility.
  }, [limit, remaining]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3.5">
        {tools.slice(0, limit).map(renderTool)}
      </div>
      {remaining > 0 && (
        <div ref={more} className="flex justify-center">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setLimit(n => n + GRID_PAGE_SIZE)}>
            Show more ({remaining} remaining)
          </Button>
        </div>
      )}
    </>
  );
}
