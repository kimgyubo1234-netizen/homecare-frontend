import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toIncidentEvent } from '@/lib/incident';
import type { IncidentEvent, IncidentListResponse } from '@/types/api';

interface UseActionPollingOptions {
  patientId: string;
  intervalMs?: number;
  delayThresholdMs?: number;
}

interface UseActionPollingResult {
  latestEvent: IncidentEvent | null;
  isConnected: boolean;
  isDelayed: boolean;
}

const FAILURE_LIMIT = 3;

// 실시간 오버레이 소스: GET /api/v1/incidents (사건 단위, JWT 인증).
// 최신 사건 1건을 폴링하여 현재 상태로 표시한다. 사건은 raw 프레임보다 드물게
// 발생하므로, 최신 사건이 delayThresholdMs(기본 60초)보다 오래됐으면 "안전"으로 처리.
export function useActionPolling({
  patientId,
  intervalMs = 3000,
  delayThresholdMs = 60_000,
}: UseActionPollingOptions): UseActionPollingResult {
  const [latestEvent, setLatestEvent] = useState<IncidentEvent | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isDelayed, setIsDelayed] = useState(false);

  const failureCountRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const params = new URLSearchParams({ patient_id: patientId, limit: '1' });
        const data = await apiFetch<IncidentListResponse>(`/api/v1/incidents?${params}`);
        const item = data.items?.[0] ?? null;
        const event = item ? toIncidentEvent(item) : null;

        if (!active) return;
        failureCountRef.current = 0;
        setIsConnected(true);

        if (event) {
          setLatestEvent(event);
          const age = Date.now() - new Date(event.ts_utc).getTime();
          setIsDelayed(age > delayThresholdMs);
        } else {
          setIsDelayed(true);
        }
      } catch {
        if (!active) return;
        failureCountRef.current += 1;
        if (failureCountRef.current >= FAILURE_LIMIT) {
          setIsConnected(false);
        }
      }

      if (active) {
        setTimeout(poll, intervalMs);
      }
    }

    poll();

    return () => {
      active = false;
    };
  }, [patientId, intervalMs, delayThresholdMs]);

  return { latestEvent, isConnected, isDelayed };
}
