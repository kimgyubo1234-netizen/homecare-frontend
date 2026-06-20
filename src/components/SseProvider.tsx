import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import type { AlertItem, PatientListItem } from '@/types/api';

const RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000];

const levelLabel: Record<string, string> = {
  critical: '위험',
  high: '높음',
  medium: '주의',
  low: '알림',
};

function playAlertSound(critical: boolean) {
  try {
    const ctx = new AudioContext();
    const frequencies = critical ? [880, 660, 880] : [660];
    let time = ctx.currentTime;
    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc.start(time);
      osc.stop(time + 0.3);
      time += 0.35;
    }
  } catch { /* ignore */ }
}

function showBrowserNotification(alert: AlertItem, patientName: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const levelText = levelLabel[alert.level] ?? alert.level;
  new Notification(`[${levelText}] ${patientName} 어르신`, {
    body: alert.message || alert.alert_type,
    icon: '/favicon.ico',
    tag: `alert-${alert.id}`,
  });
}

function showAlertToast(alert: AlertItem, patientName: string) {
  const title = `[${levelLabel[alert.level] ?? alert.level}] ${patientName} 어르신`;
  const opts = {
    description: alert.message || alert.alert_type,
    duration: alert.level === 'critical' ? 10_000 : 6_000,
  };
  if (alert.level === 'critical' || alert.level === 'high') {
    toast.error(title, opts);
  } else if (alert.level === 'medium') {
    toast.warning(title, opts);
  } else {
    toast.info(title, opts);
  }
}

export default function SseProvider() {
  const queryClient = useQueryClient();
  const retryRef = useRef(0);
  const activeRef = useRef(true);

  // 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;

    async function connect() {
      if (!activeRef.current) return;

      const token = useAuthStore.getState().token;
      if (!token) return;

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/v1/alerts/stream`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok || !res.body) {
          scheduleReconnect();
          return;
        }

        retryRef.current = 0;
        reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventType = '';
        let eventData = '';

        while (activeRef.current) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.slice(5).trim();
            } else if (line === '') {
              if (eventType && eventData) {
                handleEvent(eventType, eventData);
              }
              eventType = '';
              eventData = '';
            }
          }
        }
      } catch {
        // network error or stream closed
      } finally {
        reader?.cancel().catch(() => {});
      }

      if (activeRef.current) scheduleReconnect();
    }

    function handleEvent(type: string, dataStr: string) {
      if (type === 'CONNECTED' || type === 'PING') return;
      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;
        if (type === 'ALERT') {
          const alert = data as unknown as AlertItem;
          const patients = queryClient.getQueryData<PatientListItem[]>(['patient-list']) ?? [];
          const patientName = patients.find(p => p.patient_id === alert.patient_id)?.name ?? alert.patient_id;
          showAlertToast(alert, patientName);
          const isCritical = alert.level === 'critical' || alert.level === 'high';
          playAlertSound(isCritical);
          showBrowserNotification(alert, patientName);
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
        } else if (type === 'RISK_SCORE') {
          const patientId = typeof data.patient_id === 'string' ? data.patient_id : null;
          if (patientId) {
            queryClient.invalidateQueries({ queryKey: ['dashboard', patientId] });
            queryClient.invalidateQueries({ queryKey: ['patient-list'] });
          }
        }
      } catch {
        // ignore malformed events
      }
    }

    function scheduleReconnect() {
      if (!activeRef.current) return;
      const delay = RETRY_DELAYS[Math.min(retryRef.current, RETRY_DELAYS.length - 1)];
      retryRef.current++;
      setTimeout(connect, delay);
    }

    connect();

    return () => {
      activeRef.current = false;
    };
  }, [queryClient]);

  return null;
}
