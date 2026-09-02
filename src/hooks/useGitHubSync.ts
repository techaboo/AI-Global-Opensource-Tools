import { useCallback, useEffect, useRef, useState } from 'react';
import type { AITool, LiveMap, LiveRepoData } from '@/types';

const STORAGE_KEY = 'osi-atlas-live-v1';
const TOKEN_KEY = 'osi-atlas-gh-token';
const CONCURRENCY = 4;

function loadStored(): LiveMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LiveMap) : {};
  } catch {
    return {};
  }
}

function loadToken(): string {
  // Local dev can also set VITE_GITHUB_TOKEN in a gitignored .env file
  const env = (import.meta.env.VITE_GITHUB_TOKEN as string | undefined) ?? '';
  try {
    return localStorage.getItem(TOKEN_KEY) ?? env;
  } catch {
    return env;
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
  const [token, setTokenState] = useState<string>(loadToken);
  const abortRef = useRef(false);
  const tokenRef = useRef(token);

  const setToken = useCallback((t: string) => {
    const clean = t.trim();
    tokenRef.current = clean;
    setTokenState(clean);
    try {
      if (clean) localStorage.setItem(TOKEN_KEY, clean);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liveMap));
    } catch { /* storage full — ignore */ }
  }, [liveMap]);

  // On first load, merge the CI-generated snapshot (public/live-snapshot.json).
  // Local browser sync data wins when newer.
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}live-snapshot.json`)
      .then(r => (r.ok ? r.json() : null))
      .then((snap: { repos?: Record<string, LiveRepoData> } | null) => {
        if (cancelled || !snap?.repos) return;
        setLiveMap(prev => {
          const merged = { ...prev };
          for (const [id, data] of Object.entries(snap.repos!)) {
            if (!merged[id] || data.fetchedAt > merged[id].fetchedAt) merged[id] = data;
          }
          return merged;
        });
      })
      .catch(() => { /* no snapshot available — fine */ });
    return () => { cancelled = true; };
  }, []);

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
          const data = await fetchRepo(tool.repo!, tokenRef.current);
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
      const data = await fetchRepo(tool.repo, tokenRef.current);
      const full = { ...data, fetchedAt: Date.now() };
      setLiveMap(prev => ({ ...prev, [tool.id]: full }));
      return full;
    } catch {
      return null;
    }
  }, []);

  const lastSync = Object.values(liveMap).reduce((m, d) => Math.max(m, d.fetchedAt), 0);

  return { liveMap, syncing, progress, rateLimited, syncTools, fetchOne, lastSync, syncedCount: Object.keys(liveMap).length, token, setToken, hasToken: token.length > 0 };
}
