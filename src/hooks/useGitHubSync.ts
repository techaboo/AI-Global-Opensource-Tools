import { useCallback, useEffect, useRef, useState } from 'react';
import type { AITool, LiveMap, LiveRepoData } from '@/types';

const STORAGE_KEY = 'osi-atlas-live-v1';
const TOKEN_KEY = 'osi-atlas-gh-token';
const CONCURRENCY = 4;

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function loadStored(): LiveMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LiveMap) : {};
  } catch {
    return {};
  }
}

async function fetchRepo(repo: string, token: string): Promise<Omit<LiveRepoData, 'fetchedAt'>> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
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
  const [token, setTokenState] = useState<string>(getStoredToken);
  const abortRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liveMap));
    } catch { /* storage full — ignore */ }
  }, [liveMap]);

  const saveToken = useCallback((t: string) => {
    setTokenState(t);
    setStoredToken(t);
  }, []);

  const syncTools = useCallback(async (tools: AITool[], max = 60) => {
    const withRepo = tools.filter(t => t.repo).slice(0, max);
    if (withRepo.length === 0) return;
    setSyncing(true);
    setRateLimited(false);
    abortRef.current = false;
    setProgress({ done: 0, total: withRepo.length });

    const currentToken = getStoredToken();
    let idx = 0;
    const worker = async () => {
      while (idx < withRepo.length && !abortRef.current) {
        const tool = withRepo[idx++];
        try {
          const data = await fetchRepo(tool.repo!, currentToken);
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
      const data = await fetchRepo(tool.repo, getStoredToken());
      const full = { ...data, fetchedAt: Date.now() };
      setLiveMap(prev => ({ ...prev, [tool.id]: full }));
      return full;
    } catch {
      return null;
    }
  }, []);

  const lastSync = Object.values(liveMap).reduce((m, d) => Math.max(m, d.fetchedAt), 0);

  return { liveMap, syncing, progress, rateLimited, token, saveToken, syncTools, fetchOne, lastSync, syncedCount: Object.keys(liveMap).length };
}
