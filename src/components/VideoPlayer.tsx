import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { WifiOff } from 'lucide-react';

interface Props {
  streamPath: string;
  onStatusChange?: (isLive: boolean) => void;
  overlayPanel?: ReactNode;
}

export default function VideoPlayer({ streamPath, onStatusChange, overlayPanel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');

  const notifyStatus = useCallback(
    (live: boolean) => {
      setStatus(live ? 'live' : 'error');
      onStatusChange?.(live);
    },
    [onStatusChange],
  );

  useEffect(() => {
    let active = true;

    function cleanup() {
      pcRef.current?.close();
      pcRef.current = null;
      if (retryRef.current) clearTimeout(retryRef.current);
    }

    async function connect() {
      if (!active) return;
      setStatus('connecting');
      cleanup();

      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pcRef.current = pc;

        const videoTransceiver = pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // mediamtx/ffmpeg(libx264) 스트림과 코덱 매칭을 위해 H264 우선 설정
        const caps = RTCRtpReceiver.getCapabilities('video');
        if (caps) {
          const h264 = caps.codecs.filter(c => c.mimeType === 'video/H264');
          const rest = caps.codecs.filter(c => c.mimeType !== 'video/H264');
          if (h264.length > 0) videoTransceiver.setCodecPreferences([...h264, ...rest]);
        }

        pc.ontrack = (e) => {
          const video = videoRef.current;
          if (active && video && e.streams[0]) {
            video.srcObject = e.streams[0];
          }
        };

        pc.onconnectionstatechange = () => {
          if (!active) return;
          if (pc.connectionState === 'connected') notifyStatus(true);
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            notifyStatus(false);
            retryRef.current = setTimeout(connect, 5000);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // ICE 후보 수집이 끝날 때까지 대기 (mediamtx는 완전한 SDP 필요)
        await new Promise<void>(resolve => {
          if (pc.iceGatheringState === 'complete') { resolve(); return; }
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
        });

        const res = await fetch(
          `${import.meta.env.VITE_MEDIA_BASE}/viewer/${streamPath}/whep`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/sdp' },
            body: pc.localDescription!.sdp,  // ICE 수집 완료 후 전송
          },
        );
        if (!res.ok) throw new Error(`WHEP ${res.status}`);

        const sdp = await res.text();
        await pc.setRemoteDescription({ type: 'answer', sdp });
      } catch {
        if (active) {
          notifyStatus(false);
          retryRef.current = setTimeout(connect, 5000);
        }
      }
    }

    connect();
    return () => {
      active = false;
      cleanup();
    };
  }, [streamPath, notifyStatus]);

  return (
    <div className="relative aspect-video bg-black rounded-md overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        muted
      />
      {overlayPanel && (
        <div className="absolute top-3 left-3 z-10">
          {overlayPanel}
        </div>
      )}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-white text-sm animate-pulse">연결 중...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85">
          <div className="flex size-14 items-center justify-center rounded-full bg-red-500/20 ring-1 ring-red-500/40">
            <WifiOff className="size-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-red-400">영상 연결 실패</p>
            <p className="mt-1 text-xs text-white/50">카메라 연결 상태를 확인해주세요</p>
          </div>
        </div>
      )}
    </div>
  );
}
