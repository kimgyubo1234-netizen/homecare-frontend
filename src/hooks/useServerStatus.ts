import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';

export function useServerStatus(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function ping() {
      try {
        const token = useAuthStore.getState().token;
        await fetch(`${import.meta.env.VITE_API_BASE}/api/v1/alerts?limit=1`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (active) setOnline(true);
      } catch {
        if (active) setOnline(false);
      }
      if (active) timer = setTimeout(ping, 30_000);
    }

    ping();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return online;
}
