import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { EventListResponse, EventItem } from '@/types/api';

export function useAllEvents(limit = 50) {
  return useQuery({
    queryKey: ['events-feed', limit],
    queryFn: async (): Promise<EventItem[]> => {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await apiFetch<EventListResponse>(`/api/v1/events?${params}`);
      return data.items ?? [];
    },
    staleTime: 30 * 1000,
  });
}
