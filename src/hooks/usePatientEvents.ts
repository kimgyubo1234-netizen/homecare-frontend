import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ActionEventListResponse, ActionEvent } from '@/types/api';

// 특정 어르신의 전체 감지 이벤트 (알림 분석 차트 + 위험점수 평균용)
// /api/v1/events 는 risk_score 등 액션 필드를 포함하므로 ActionEvent 로 받는다.
export function usePatientEvents(patientId: string, limit = 200) {
  return useQuery({
    queryKey: ['patient-events', patientId, limit],
    queryFn: async (): Promise<ActionEvent[]> => {
      const params = new URLSearchParams({ patient_id: patientId, limit: String(limit) });
      const data = await apiFetch<ActionEventListResponse>(`/api/v1/events?${params}`);
      return data.items ?? [];
    },
    enabled: !!patientId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
  });
}
