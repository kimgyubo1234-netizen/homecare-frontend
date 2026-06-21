import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { EventListResponse, EventItem } from '@/types/api';

// 특정 어르신의 전체 감지 이벤트 (알림 분석 차트용)
export function usePatientEvents(patientId: string, limit = 200) {
  return useQuery({
    queryKey: ['patient-events', patientId, limit],
    queryFn: async (): Promise<EventItem[]> => {
      const params = new URLSearchParams({ patient_id: patientId, limit: String(limit) });
      const data = await apiFetch<EventListResponse>(`/api/v1/events?${params}`);
      return data.items ?? [];
    },
    enabled: !!patientId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
  });
}
