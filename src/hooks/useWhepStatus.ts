import { useEffect, useState } from 'react';

export function useWhepStatus(streamPath: string): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    let pc: RTCPeerConnection | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function probe() {
      if (!active) return;

      try {
        pc = new RTCPeerConnection({ iceServers: [] });
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise<void>(resolve => {
          if (pc!.iceGatheringState === 'complete') { resolve(); return; }
          pc!.onicegatheringstatechange = () => {
            if (pc!.iceGatheringState === 'complete') resolve();
          };
        });

        const res = await fetch(
          `${import.meta.env.VITE_MEDIA_BASE}/viewer/${streamPath}/whep`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/sdp' },
            body: pc.localDescription!.sdp,
          },
        );

        pc.close();
        pc = null;

        if (active) {
          setConnected(res.ok);
          retryTimer = setTimeout(probe, 30_000);
        }
      } catch {
        if (pc) { pc.close(); pc = null; }
        if (active) {
          setConnected(false);
          retryTimer = setTimeout(probe, 30_000);
        }
      }
    }

    probe();

    return () => {
      active = false;
      if (pc) pc.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [streamPath]);

  return connected;
}
