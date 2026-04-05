import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { useSocket } from '../context/SocketContext';

/**
 * useApi — declarative data fetcher with optional polling/socket updates
 * @param {string|null} path    — API path (null = skip fetch)
 * @param {any[]} deps          — extra dependencies to re-fetch on
 * @param {string} socketEvent  — optional socket.io event name to listen for automatic re-fetching
 */
export function useApi(path, deps = [], socketEvent = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError]     = useState(null);
  const socket = useSocket();

  const fetchData = useCallback(async (quiet = false) => {
    if (!path) return;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const result = await api.get(path);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    fetchData();
    
    if (socket && socketEvent) {
      const handler = () => fetchData(true);
      socket.on(socketEvent, handler);
      return () => {
        socket.off(socketEvent, handler);
      };
    }
  }, [fetchData, socket, socketEvent]);

  return { data, loading, error, refetch: () => fetchData() };
}

/**
 * useApiMutate — imperative mutation helper (POST / PUT / DELETE)
 * Returns { mutate, loading, error }
 * @param {function} apiFn — e.g. () => api.post('/expenses', body)
 */
export function useApiMutate(apiFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  return { mutate, loading, error };
}
