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
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}
