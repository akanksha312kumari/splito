import { useApi } from './useApi';

/**
 * Recalculates unread notifications directly connected to Socket connection updates.
 * Returns { count, refetch }
 */
export function useNotifCount() {
  const { data, refetch } = useApi('/notifications/unread-count', [], 'notification');
  return { count: data?.count ?? 0, refetch };
}
