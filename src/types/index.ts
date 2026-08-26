export type ToolStatus = 'active' | 'maintenance' | 'archived';

export interface Category {
  id: string;
  label: string;
  icon: string; // lucide icon name key
  color: string; // hex accent
  blurb: string;
}

export interface AITool {
  id: string;
  name: string;
  org: string;
  cat: string; // category id
  tagline: string;
  desc: string;
  license: string;
  lang: string;
  stars: number; // snapshot (mid-2026 research), superseded by live sync
  repo?: string; // owner/name for GitHub API
  tags: string[];
  hot?: boolean;
  status: ToolStatus;
  year: number;
}

export interface LiveRepoData {
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string;
  fetchedAt: number;
}

export type LiveMap = Record<string, LiveRepoData>; // keyed by tool id
