import { useEffect, useRef, useState } from 'react';
import { api, errorOf, type ApiError, type Cursor, type FeedPage } from './api';
import type { Post } from './data';

export function useSaved<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; }
  });
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState('');
  const current = useRef(value); current.current = value;
  useEffect(() => {
    let canceled = false; let retry: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const saved = await api<T | null>('stateGet', { key });
        if (canceled) return;
        if (saved !== null) setValue(saved);
        else await api('stateSet', { key, value: current.current });
        setStorageError(''); setHydrated(true);
      } catch (error) {
        if (!canceled) { setStorageError(errorOf(error).message); retry = setTimeout(load, 5000); }
      }
    }
    void load();
    return () => { canceled = true; clearTimeout(retry); };
  }, [key]);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
    if (!hydrated) return;
    const timer = setTimeout(() => { void api('stateSet', { key, value }).then(() => setStorageError('')).catch(error => setStorageError(errorOf(error).message)); }, 200);
    return () => clearTimeout(timer);
  }, [key, value, hydrated]);
  return [value, setValue, storageError, hydrated] as const;
}

export function useFeed(request: Record<string, unknown>, localIds: number[] | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const cursor = useRef<Cursor | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const key = JSON.stringify([request, localIds]);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setPosts([]); setError(null); setLoading(true); setHasMore(false); cursor.current = null; busy.current = true;
    const timer = setTimeout(() => {
      const call = localIds ? api<Post[]>('localPosts', { ids: localIds }, controller.signal) : api<FeedPage>('feed', request, controller.signal);
      void call.then(result => {
        if (current !== generation.current) return;
        if (Array.isArray(result)) setPosts(result);
        else { setPosts(result.posts); cursor.current = result.cursor; setHasMore(result.hasMore); }
      }).catch(error => { if (current === generation.current && !controller.signal.aborted) setError(errorOf(error)); })
        .finally(() => { if (current === generation.current) { setLoading(false); busy.current = false; } });
    }, request.query ? 450 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
    // The serialized key includes every field; avoid restarting for object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh]);
  const loadMore = async () => {
    if (busy.current || !hasMore || !cursor.current) return;
    const current = generation.current; busy.current = true; setLoading(true); setError(null);
    try {
      const result = await api<FeedPage>('feed', { ...request, cursor: cursor.current });
      if (current !== generation.current) return;
      setPosts(previous => [...previous, ...result.posts.filter(p => !previous.some(old => old.id === p.id))]);
      cursor.current = result.cursor; setHasMore(result.hasMore);
    } catch (error) { if (current === generation.current) setError(errorOf(error)); }
    finally { if (current === generation.current) { setLoading(false); busy.current = false; } }
  };
  return { posts, setPosts, loading, error, hasMore, loadMore, reload: () => setRefresh(n => n + 1) };
}
