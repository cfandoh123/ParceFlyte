'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** JSON fetch that surfaces the API's error message rather than a bare status. */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

/**
 * GET a URL, tracking loading and error state.
 * Pass `null` to skip the request — handy while a dependency is still loading.
 */
export function useApi(url, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip && Boolean(url));
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!url || skip) return;
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(url);
      // Ignore responses from superseded requests.
      if (request === latest.current) setData(result);
    } catch (err) {
      if (request === latest.current) setError(err.message);
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [url, skip]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
