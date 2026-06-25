import { useEffect } from 'react';
import { Video, X } from 'lucide-react';
import { formatKST } from '@/lib/format';
import { translateEventType } from '@/lib/event-labels';
import type { Clip } from '@/types/api';

// 클립 재생 모달 — 클립 목록/최근 이벤트 등 여러 곳에서 공유.
// video_url(presigned)은 만료되므로 호출 측에서 재생 직전 refetch 후 신선한 clip을 넘긴다.
export default function ClipPlayerModal({ clip, onClose }: { clip: Clip | null; onClose: () => void }) {
  useEffect(() => {
    if (!clip) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [clip, onClose]);

  if (!clip) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Video className="size-4 shrink-0 text-blue-600" />
            <span className="truncate text-sm font-semibold text-slate-800">
              {translateEventType(clip.event_type)}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{formatKST(clip.occurred_at_utc)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
        <video
          key={clip.video_url}
          src={clip.video_url}
          controls
          autoPlay
          playsInline
          className="max-h-[70vh] w-full bg-black"
        />
      </div>
    </div>
  );
}
