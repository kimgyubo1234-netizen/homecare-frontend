import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { DashboardResponse } from '@/types/api';

export function useDashboard(patientId: string) {
  return useQuery({
    queryKey: ['dashboard', patientId],
    queryFn: () =>
      apiFetch<DashboardResponse>(
        `/api/v1/dashboard?patient_id=${encodeURIComponent(patientId)}`
      ),
    enabled: !!patientId,
    // 환자 기본정보(이름·성별·나이·상태) 위주라 거의 고정 → 폴링 없이 진입 시 1회 + 포커스 시 갱신
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
