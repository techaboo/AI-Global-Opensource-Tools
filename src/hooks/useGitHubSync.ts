import { useCallback, useEffect, useRef, useState } from 'react';
import type { AITool, LiveMap, LiveRepoData } from '@/types';

const STORAGE_KEY = 'osi-atlas-live-v1';
const CONCURRENCY = 4;

function loadStored(): LiveMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LiveMap) : {};
  } catch {
    return {};
  }
}

async function fetchRepo(repo: string): Promise<Omit<LiveRepoData, 'fetchedAt'>> {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error('rate-limited');
  }
  if (!res.ok) throw new Error(`http-${res.status}`);
  const j = await res.json();
  return {
    stars: j.stargazers_count ?? 0,
    forks: j.forks_count ?? 0,
    openIssues: j.open_issues_count ?? 0,
    pushedAt: j.pushed_at ?? '',
  };
}

export function useGitHubSync() {
  const [liveMap, setLiveMap] = useState<LiveMap>(loadStored);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rateLimited, setRateLimited] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liveMap));
    } catch { /* storage full — ignore */ }
  }, [liveMap]);

  const syncTools = useCallback(async (tools: AITool[], max = 60) => {
    const withRepo = tools.filter(t => t.repo).slice(0, max);
    if (withRepo.length === 0) return;
    setSyncing(true);
    setRateLimited(false);
    abortRef.current = false;
    setProgress({ done: 0, total: withRepo.length });

    let idx = 0;
    const worker = async () => {
      while (idx < withRepo.length && !abortRef.current) {
        const tool = withRepo[idx++];
        try {
          const data = await fetchRepo(tool.repo!);
          setLiveMap(prev => ({ ...prev, [tool.id]: { ...data, fetchedAt: Date.now() } }));
        } catch (e) {
          if ((e as Error).message === 'rate-limited') {
            setRateLimited(true);
            abortRef.current = true;
            return;
          }
          // other errors: skip tool
        } finally {
          setProgress(p => ({ ...p, done: p.done + 1 }));
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setSyncing(false);
  }, []);

  const fetchOne = useCallback(async (tool: AITool): Promise<LiveRepoData | null> => {
    if (!tool.repo) return null;
    try {
      const data = await fetchRepo(tool.repo);
      const full = { ...data, fetchedAt: Date.now() };
      setLiveMap(prev => ({ ...prev, [tool.id]: full }));
      return full;
    } catch {
      return null;
    }
  }, []);

  const lastSync = Object.values(liveMap).reduce((m, d) => Math.max(m, d.fetchedAt), 0);

  return { liveMap, syncing, progress, rateLimited, syncTools, fetchOne, lastSync, syncedCount: Object.keys(liveMap).length };
}
