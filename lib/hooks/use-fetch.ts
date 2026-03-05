// ============================================================================
// lib/hooks/use-fetch.ts
// Hook reutilizable para fetch de datos con estado loading/error
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseFetchOptions {
  immediate?: boolean;  // fetch on mount (default: true)
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useFetch<T>(url: string | null, options: UseFetchOptions = {}): UseFetchResult<T> {
  const { immediate = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (immediate && url) fetchData();
  }, [fetchData, immediate, url]);

  return { data, loading, error, refetch: fetchData, setData };
}

// ── Mutation helper ─────────────────────────────────────────────────────

interface MutateOptions {
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
}

export function useMutate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (url: string, options: MutateOptions = {}) => {
    const { method = 'POST', body, onSuccess, onError } = options;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = json.error ?? `Error ${res.status}`;
        setError(msg);
        onError?.(msg);
        return null;
      }

      onSuccess?.(json);
      return json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de red';
      setError(msg);
      onError?.(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}
