import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ActionEventListResponse, ActionEvent } from '@/types/api';

// /api/v1/events 는 risk_score 등 액션 필드를 포함하므로 ActionEvent 로 받는다.
export function useAllEvents(limit = 50) {
  return useQuery({
    queryKey: ['events-feed', limit],
    queryFn: async (): Promise<ActionEvent[]> => {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await apiFetch<ActionEventListResponse>(`/api/v1/events?${params}`);
      return data.items ?? [];
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}
