import { useEffect, useRef, useState, useCallback } from 'react';
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ patient_id: patientId, limit: '1' });
      const data = await apiFetch<ActionEventListResponse>(
        `/api/v1/events?${params}`,
      );
      const event = data.items?.[0] ?? null;

      failureCountRef.current = 0;
      setIsConnected(true);

      if (event) {
        setLatestEvent(event);
        const age = Date.now() - new Date(event.capture_ts).getTime();
        setIsDelayed(age > delayThresholdMs);
      }
    } catch {
      failureCountRef.current += 1;
      if (failureCountRef.current >= FAILURE_LIMIT) {
        setIsConnected(false);
      }
    }
  }, [patientId, delayThresholdMs]);

  useEffect(() => {
    // 마운트 즉시 1회 실행 후 인터벌 시작
    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [poll, intervalMs]);

  return { latestEvent, isConnected, isDelayed };
}
