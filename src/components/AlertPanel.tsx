import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Bell, ChevronRight } from 'lucide-react';
import { useAllEvents } from '@/hooks/useAllEvents';
import { usePatientList } from '@/hooks/usePatientList';
import { formatKST } from '@/lib/format';
import { translateEventType, eventSeverityDot, eventSeverityBadge } from '@/lib/event-labels';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Filter = 'all' | 'today' | 'danger';

interface Props {
  open: boolean;
  onClose: () => void;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function AlertPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: allEvents, isLoading } = useAllEvents(200);
  const { data: patients } = usePatientList();

  const patientMap = useMemo(() => {
    if (!patients) return {} as Record<string, string>;
    return Object.fromEntries(patients.map(p => [p.patient_id, p.name]));
  }, [patients]);

  const filtered = useMemo(() => {
    if (!allEvents) return [];
    const now = Date.now();
    return [...allEvents]
      .filter(e => {
        if (filter === 'today')  return now - new Date(e.ts_utc).getTime() < 24 * 60 * 60 * 1000;
        if (filter === 'danger') return e.severity >= 3;
        return true;
      })
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
      .slice(0, 50);
  }, [allEvents, filter]);

  const todayCount = useMemo(() => {
    if (!allEvents) return 0;
    const now = Date.now();
    return allEvents.filter(e => now - new Date(e.ts_utc).getTime() < 24 * 60 * 60 * 1000).length;
  }, [allEvents]);

  const dangerCount = useMemo(() => {
    return allEvents?.filter(e => e.severity >= 3).length ?? 0;
  }, [allEvents]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all',    label: '전체', count: allEvents?.length ?? 0 },
    { key: 'today',  label: '오늘', count: todayCount },
    { key: 'danger', label: '위험', count: dangerCount },
  ];

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-96 flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bell className="size-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">감지 이력</h2>
            {todayCount > 0 && (
              <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                오늘 {todayCount}건
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          {FILTERS.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  filter === key
                    ? 'bg-white/30 text-white'
                    : key === 'danger'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 이벤트 목록 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <Bell className="size-8 text-slate-200" />
              <p className="text-sm text-slate-400">
                {filter === 'today'  ? '오늘 감지된 이벤트가 없습니다' :
                 filter === 'danger' ? '위험 이벤트가 없습니다' :
                 '감지된 이벤트가 없습니다'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filtered.map(event => {
                const name = patientMap[event.patient_id] ?? event.patient_id;
                const dot = eventSeverityDot(event.severity);
                const badge = eventSeverityBadge(event.severity);
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => { navigate(`/dashboard/${event.patient_id}`); onClose(); }}
                      className="w-full text-left px-5 py-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-slate-800">
                              {name} 어르신
                            </span>
                            <span
                              className="shrink-0 text-[10px] text-slate-400"
                              title={formatKST(event.ts_utc)}
                            >
                              {relativeTime(event.ts_utc)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`py-0 text-[10px] ${badge.color}`}>
                              {badge.label}
                            </Badge>
                            <span className="text-xs text-slate-500">{translateEventType(event.event_type)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 하단 링크 */}
        <div className="border-t border-slate-100 px-5 py-4">
          <Link
            to="/alerts"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-slate-50 hover:text-blue-600"
          >
            전체 이벤트 이력 보기
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </aside>
    </>
  );
}
