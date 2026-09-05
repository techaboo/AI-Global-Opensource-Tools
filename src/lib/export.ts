import type { AITool, Category, LiveMap } from '@/types';

export interface ExportRow {
  id: string;
  name: string;
  org: string;
  category: string;
  license: string;
  language: string;
  stars: number;
  status: string;
  year: number;
  repo: string;
  tags: string;
  tagline: string;
  live: 'yes' | 'no';
}

export function toolsToExportRows(tools: AITool[], liveMap: LiveMap, catMap: Map<string, Category>): ExportRow[] {
  return tools.map(t => ({
    id: t.id,
    name: t.name,
    org: t.org,
    category: catMap.get(t.cat)?.label ?? t.cat,
    license: t.license,
    language: t.lang,
    stars: liveMap[t.id]?.stars ?? t.stars,
    status: t.status,
    year: t.year,
    repo: t.repo ?? '',
    tags: t.tags.join('; '),
    tagline: t.tagline,
    live: liveMap[t.id] ? 'yes' : 'no',
  }));
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: ExportRow[]): string {
  const keys: (keyof ExportRow)[] = [
    'id', 'name', 'org', 'category', 'license', 'language', 'stars',
    'status', 'year', 'repo', 'tags', 'tagline', 'live',
  ];
  const header = keys.join(',');
  const body = rows.map(r => keys.map(k => csvEscape(r[k])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

export function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFiltered(tools: AITool[], liveMap: LiveMap, catMap: Map<string, Category>, format: 'csv' | 'json') {
  const rows = toolsToExportRows(tools, liveMap, catMap);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    downloadText(`ai-atlas-${stamp}.json`, JSON.stringify(rows, null, 2), 'application/json');
    return;
  }
  downloadText(`ai-atlas-${stamp}.csv`, rowsToCsv(rows), 'text/csv;charset=utf-8');
}
