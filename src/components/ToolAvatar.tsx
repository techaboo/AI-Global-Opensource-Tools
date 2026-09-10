import { useState } from 'react';
import { ownerAvatarUrl } from '@/lib/favicon';
import { CategoryIcon } from '@/components/CategoryNav';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  repo?: string;
  categoryIcon: string;
  categoryColor?: string;
  size: number;
  className?: string;
}

/** Owner avatar with a skeleton while loading and a category-icon fallback on error/missing repo. */
export function ToolAvatar({ repo, categoryIcon, categoryColor, size, className }: Props) {
  const url = ownerAvatarUrl(repo, size * 2);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(url ? 'loading' : 'error');

  if (!url || state === 'error') {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-md bg-muted shrink-0', className)}
        style={{ width: size, height: size }}
      >
        <CategoryIcon icon={categoryIcon} className="h-[60%] w-[60%]" style={{ color: categoryColor }} />
      </span>
    );
  }

  return (
    <span className={cn('relative inline-block shrink-0 rounded-md overflow-hidden', className)} style={{ width: size, height: size }}>
      {state === 'loading' && <Skeleton className="absolute inset-0 rounded-md" />}
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        className={cn('h-full w-full object-cover', state !== 'loaded' && 'opacity-0')}
      />
    </span>
  );
}
