import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_PREFIX = 'calqulusrms_offline_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB safe limit (localStorage is ~5MB)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
}

function estimateSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}

export function useOfflineData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const cacheKey = `${CACHE_PREFIX}${key}`;

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getCachedData = useCallback((): T | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);
        const isExpired = Date.now() - entry.timestamp > CACHE_EXPIRY_MS;
        if (!isExpired) {
          return entry.data;
        }
        localStorage.removeItem(cacheKey);
      }
    } catch {
      // Corrupted cache or read error — silently ignore
    }
    return null;
  }, [cacheKey]);

  const setCachedData = useCallback((data: T) => {
    try {
      const size = estimateSize(data);
      if (size > MAX_CACHE_SIZE_BYTES) {
        console.warn(`[useOfflineData] Cache entry "${key}" too large (${size} bytes), skipping cache`);
        return;
      }
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        size,
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (e) {
      if (isQuotaError(e)) {
        console.warn(`[useOfflineData] localStorage quota exceeded for "${key}", clearing old caches`);
        // Clear all CALQULUS PMS caches to free space
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k?.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
        }
      }
    }
  }, [cacheKey, key]);

  const fetchData = useCallback(async () => {
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (!navigator.onLine) {
      const cached = getCachedData();
      if (cached) {
        setData(cached);
        setIsFromCache(true);
        setLoading(false);
        return;
      }
      setError(new Error('No internet connection and no cached data available'));
      setLoading(false);
      return;
    }

    try {
      const freshData = await fetcherRef.current();
      setData(freshData);
      setIsFromCache(false);
      setCachedData(freshData);
    } catch (e) {
      const cached = getCachedData();
      if (cached) {
        setData(cached);
        setIsFromCache(true);
      } else {
        setError(e instanceof Error ? e : new Error('Failed to fetch data'));
      }
    } finally {
      setLoading(false);
    }
  }, [getCachedData, setCachedData, options?.enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const wasOfflineRef = useRef(isOffline);
  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      fetchData();
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline, fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isOffline,
    isFromCache,
    refetch,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
