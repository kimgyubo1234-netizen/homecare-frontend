import { useEffect, useState } from 'react';
import { Video, Play, X, Film } from 'lucide-react';
import { useClips } from '@/hooks/useClips';
import { formatKST } from '@/lib/format';
import { translateEventType, eventSeverityBadge } from '@/lib/event-labels';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

function fmtSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '';
  return `${sec.toFixed(1)}초`;
}

export default function ClipsCard({ patientId }: { patientId: string }) {
  const { data: clips, isLoading, error, refetch } = useClips({ patientId, limit: 50 });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 만료 URL 방지 — 재생 직전 목록을 새로 받아 신선한 presigned URL 사용
  const openClip = async (id: number) => {
    setSelectedId(id);
    refetch();
  };

  const selected = clips?.find(c => c.id === selectedId) ?? null;

  // 모달 열려 있을 때 Esc로 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (selectedId === null) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [selectedId]);

  return (
    <Card className="col-span-12">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2">
            <Video className="size-4 text-blue-600" />
            위험 영상 클립
          </CardTitle>
          {!isLoading && clips && clips.length > 0 && (
            <span className="text-xs text-slate-400">{clips.length}건</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>클립을 불러오는 중 오류가 발생했습니다.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
          </div>
        ) : !clips || clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Film className="size-8 text-slate-200" />
            <p className="text-sm text-slate-400">저장된 영상 클립이 없습니다</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map(c => {
              const badge = eventSeverityBadge({ event_type: c.event_type, severity: 0 });
              const meta = [fmtDuration(c.actual_duration_sec), fmtSize(c.file_size_bytes)].filter(Boolean).join(' · ');
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openClip(c.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition-all hover:border-blue-200 hover:shadow-sm"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                      <Play className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`py-0 text-[10px] ${badge.color}`}>{badge.label}</Badge>
                        <span className="truncate text-sm font-medium text-slate-700">{translateEventType(c.event_type)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatKST(c.occurred_at_utc)}</p>
                      {meta && <p className="text-[11px] text-slate-400">{meta}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* 재생 모달 */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Video className="size-4 shrink-0 text-blue-600" />
                <span className="truncate text-sm font-semibold text-slate-800">
                  {translateEventType(selected.event_type)}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatKST(selected.occurred_at_utc)}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <video
              key={selected.video_url}
              src={selected.video_url}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full bg-black"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
