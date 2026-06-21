import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { AlertListResponse, AlertItem, AlertLevel, AlertSource } from '@/types/api';

interface AlertFilters {
  patientId?: string;
  source?: AlertSource;
  levels?: AlertLevel[];
  days?: number;
}

export function useAlerts({ patientId, source, levels, days = 90 }: AlertFilters = {}) {
  return useQuery({
    queryKey: ['alerts', patientId ?? '', source ?? '', days],
    queryFn: async (): Promise<AlertListResponse> => {
      const params = new URLSearchParams({ days: String(days) });
      if (patientId) params.set('patient_id', patientId);
      if (source) params.set('source', source);
      return apiFetch<AlertListResponse>(`/api/v1/alerts?${params}`);
    },
    select: (data): AlertItem[] => {
      if (!levels || levels.length === 0) return data.items;
      return data.items.filter((item) => levels.includes(item.level));
    },
    staleTime: 10 * 1000,
    refetchInterval: 20 * 1000,
    refetchOnWindowFocus: true,
  });
}
