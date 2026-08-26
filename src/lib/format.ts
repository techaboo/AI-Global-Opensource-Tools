export function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export const LICENSE_COLORS: Record<string, string> = {
  'MIT': '#10b981',
  'Apache-2.0': '#3b82f6',
  'GPL-3.0': '#f59e0b',
  'AGPL-3.0': '#ef4444',
  'BSD-3-Clause': '#8b5cf6',
  'MPL-2.0': '#06b6d4',
};

export function licenseColor(license: string): string {
  for (const key of Object.keys(LICENSE_COLORS)) {
    if (license.startsWith(key)) return LICENSE_COLORS[key];
  }
  return '#94a3b8';
}
