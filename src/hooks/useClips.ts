import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ClipListResponse, Clip } from '@/types/api';

interface UseClipsOptions {
  patientId?: string;
  eventType?: string;
  limit?: number;
}

// 위험 영상 클립 목록 — GET /api/v1/clips
// presigned video_url은 url_expires_in초 뒤 만료되므로 캐시하지 않고
// 화면 진입 시마다 새 URL을 받는다. (만료 URL 재생 시 403)
export function useClips({ patientId, eventType, limit = 50 }: UseClipsOptions = {}) {
  return useQuery({
    queryKey: ['clips', patientId ?? null, eventType ?? null, limit],
    queryFn: async (): Promise<Clip[]> => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (patientId) params.set('patient_id', patientId);
      if (eventType) params.set('event_type', eventType);
      const data = await apiFetch<ClipListResponse>(`/api/v1/clips?${params}`);
      return data.items ?? [];
    },
    enabled: patientId === undefined || !!patientId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
