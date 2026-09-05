import { useMemo } from 'react';
import type { StarPoint } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  points: StarPoint[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  title?: string;
}

export function Sparkline({ points, width = 72, height = 20, color = '#d946ef', className, title }: Props) {
  const d = useMemo(() => {
    if (points.length < 2) return '';
    const xs = points.map(p => p.t);
    const ys = points.map(p => p.s);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const pad = 1.5;
    return points.map((p, i) => {
      const x = pad + ((p.t - minX) / dx) * (width - pad * 2);
      const y = height - pad - ((p.s - minY) / dy) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [points, width, height]);

  if (!d) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
