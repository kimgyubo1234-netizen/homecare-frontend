import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toIncidentEvent } from '@/lib/incident';
import type { IncidentListResponse, IncidentEvent } from '@/types/api';

// 특정 어르신의 사건(incident) 목록 — 알림 분석 차트 + 최근 이벤트용.
// GET /api/v1/incidents?patient_id=... (사건 단위, JWT 인증)
export function usePatientEvents(patientId: string, limit = 200) {
  return useQuery({
    queryKey: ['patient-events', patientId, limit],
    queryFn: async (): Promise<IncidentEvent[]> => {
      const params = new URLSearchParams({ patient_id: patientId, limit: String(limit) });
      const data = await apiFetch<IncidentListResponse>(`/api/v1/incidents?${params}`);
      return (data.items ?? []).map(toIncidentEvent);
    },
    enabled: !!patientId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}
