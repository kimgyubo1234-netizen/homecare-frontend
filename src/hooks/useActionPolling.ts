import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { ActionEvent, ActionEventListResponse } from '@/types/api';

interface UseActionPollingOptions {
  patientId: string;
  intervalMs?: number;
  delayThresholdMs?: number;
}

interface UseActionPollingResult {
  latestEvent: ActionEvent | null;
  isConnected: boolean;
  isDelayed: boolean;
}

const FAILURE_LIMIT = 3;

export function useActionPolling({
  patientId,
  intervalMs = 1500,
  delayThresholdMs = 5000,
}: UseActionPollingOptions): UseActionPollingResult {
  const [latestEvent, setLatestEvent] = useState<ActionEvent | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isDelayed, setIsDelayed] = useState(false);

  const failureCountRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const params = new URLSearchParams({ patient_id: patientId, limit: '1' });
        const data = await apiFetch<ActionEventListResponse>(`/api/v1/events?${params}`);
        const event = data.items?.[0] ?? null;

        if (!active) return;
        failureCountRef.current = 0;
        setIsConnected(true);

        if (event) {
          setLatestEvent(event);
          const age = Date.now() - new Date(event.ts_utc).getTime();
          setIsDelayed(age > delayThresholdMs);
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
