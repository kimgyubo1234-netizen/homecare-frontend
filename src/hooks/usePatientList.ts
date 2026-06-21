import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PatientListResponse, PatientListItem } from '@/types/api';

export function usePatientList() {
  return useQuery({
    queryKey: ['patient-list'],
    queryFn: () => apiFetch<PatientListResponse>('/api/v1/patients'),
    select: (data): PatientListItem[] => data.patients,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
