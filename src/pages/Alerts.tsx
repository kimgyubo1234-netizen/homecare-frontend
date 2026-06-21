import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Circle, CheckCheck, ChevronLeft } from 'lucide-react';
import { useAlerts } from '@/hooks/useAlerts';
import { useAllEvents } from '@/hooks/useAllEvents';
import { usePatientList } from '@/hooks/usePatientList';
import { ForbiddenError } from '@/lib/api';
import { useReadStore } from '@/lib/read-store';
import { formatKST } from '@/lib/format';
import { translateEventType, eventSeverityDot, eventSeverityBadge } from '@/lib/event-labels';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { AlertLevel, AlertSource, AlertItem } from '@/types/api';

const LEVELS: { value: AlertLevel; label: string; activeClass: string; inactiveClass: string }[] = [
  { value: 'critical', label: '위험', activeClass: 'bg-red-500 text-white border-red-500', inactiveClass: 'bg-white text-red-500 border-red-300 hover:bg-red-50' },
  { value: 'high',     label: '높음', activeClass: 'bg-red-300 text-white border-red-300', inactiveClass: 'bg-white text-red-400 border-red-200 hover:bg-red-50' },
  { value: 'medium',   label: '중간', activeClass: 'bg-yellow-400 text-white border-yellow-400', inactiveClass: 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50' },
  { value: 'low',      label: '낮음', activeClass: 'bg-green-500 text-white border-green-500', inactiveClass: 'bg-white text-green-600 border-green-300 hover:bg-green-50' },
];

const SOURCES: { value: AlertSource | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'immediate', label: '즉시' },
  { value: 'trend', label: '트렌드' },
];

const levelRowClass: Record<AlertLevel, string> = {
  critical: 'border-l-2 border-l-red-500',
  high: 'border-l-2 border-l-red-300',
  medium: 'border-l-2 border-l-yellow-400',
  low: 'border-l-2 border-l-green-400',
};

const levelBadgeClass: Record<AlertLevel, string> = {
  critical: 'bg-red-100 text-red-600 border-red-200',
  high: 'bg-red-50 text-red-400 border-red-100',
  medium: 'bg-yellow-100 text-yellow-600 border-yellow-200',
  low: 'bg-green-100 text-green-600 border-green-200',
};

const sourceBadgeClass: Record<AlertSource, string> = {
  immediate: 'bg-blue-100 text-blue-500 border-blue-200',
  trend: 'bg-purple-100 text-purple-500 border-purple-200',
};

const levelLabel: Record<AlertLevel, string> = {
  critical: '위험',
  high: '높음',
  medium: '중간',
  low: '낮음',
};

const levelDotClass: Record<AlertLevel, string> = {
  critical: 'bg-red-500 animate-pulse',
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-emerald-400',
};

const historyCardClass: Record<AlertLevel, string> = {
  critical: 'border-red-200 bg-red-50/40',
  high: 'border-red-100 bg-red-50/20',
  medium: 'border-amber-100 bg-amber-50/20',
  low: 'border-slate-100 bg-white',
};

const sourceLabel: Record<AlertSource, string> = {
  immediate: '즉시',
  trend: '트렌드',
};

export default function Alerts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = '독거노인 안전 모니터링 - 알림';
  }, []);

  const patientId = searchParams.get('patient_id') ?? '';
  const source = (searchParams.get('source') ?? '') as AlertSource | '';
  const levelsParam = searchParams.get('levels') ?? '';
  const selectedLevels: AlertLevel[] = levelsParam
    ? (levelsParam.split(',') as AlertLevel[])
    : [];

  const { data: patients } = usePatientList();

  const {
    data: alerts,
    isLoading,
    error,
    refetch,
  } = useAlerts({
    patientId: patientId || undefined,
    source: source || undefined,
    levels: selectedLevels.length > 0 ? selectedLevels : undefined,
  });

  const { data: allEvents, isLoading: isEventsLoading } = useAllEvents(200);
  const filteredEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents
      .filter(e => !patientId || e.patient_id === patientId)
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime());
  }, [allEvents, patientId]);

  const [viewMode, setViewMode] = useState<'table' | 'history'>('history');
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const markRead = useReadStore((s) => s.markRead);
  const readIds = useReadStore((s) => s.readIds);

  // 페이지 열리면 미읽음 알림 전체 읽음 처리
  useEffect(() => {
    if (!alerts) return;
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length > 0) markRead(unreadIds);
  }, [alerts, markRead]);

  const patientMap = useMemo(() => {
    if (!patients) return {} as Record<string, string>;
    return Object.fromEntries(patients.map(p => [p.patient_id, p.name]));
  }, [patients]);

  const alertsByDate = useMemo(() => {
    if (!alerts || alerts.length === 0) return new Map<string, AlertItem[]>();
    const sorted = [...alerts].sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime());
    const map = new Map<string, AlertItem[]>();
    for (const a of sorted) {
      const key = new Date(a.ts_utc).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      });
      const existing = map.get(key);
      if (existing) existing.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [alerts]);

  function toggleRead(id: number) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markAllRead() {
    if (!alerts) return;
    const unreadIds = alerts.filter(a => !resolveRead(a)).map(a => a.id);
    markRead(unreadIds);
    setToggled(new Set());
  }

  function resolveRead(a: { id: number; is_read: boolean }): boolean {
    if (toggled.has(a.id)) return !a.is_read;
    return a.is_read || readIds.includes(a.id);
  }

  const unreadCount = alerts?.filter(a => !resolveRead(a)).length ?? 0;

  function setPatient(val: string) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('patient_id', val);
    else next.delete('patient_id');
    setSearchParams(next);
  }

  function setSource(val: AlertSource | '') {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('source', val);
    else next.delete('source');
    setSearchParams(next);
  }

  function toggleLevel(level: AlertLevel) {
    const next = new URLSearchParams(searchParams);
    const current = selectedLevels.includes(level)
      ? selectedLevels.filter((l) => l !== level)
      : [...selectedLevels, level];
    if (current.length > 0) next.set('levels', current.join(','));
    else next.delete('levels');
    setSearchParams(next);
  }

  const isAccessDenied = error instanceof ForbiddenError;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 transition-colors font-medium"
      >
        <ChevronLeft className="size-4" />
        뒤로가기
      </button>

      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600">
            <Bell className="size-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 leading-none">알림</h1>
              {!isLoading && alerts && alerts.length > 0 && (
                <Badge variant="secondary" className="text-xs">{alerts.length}건</Badge>
              )}
              {unreadCount > 0 && (
                <Badge className="bg-red-500 hover:bg-red-500 text-white text-xs">{unreadCount} 미읽음</Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">전체 알림 현황</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {(['history', 'table'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v === 'table' ? '테이블' : '날짜별'}
              </button>
            ))}
          </div>
          {alerts && alerts.some(a => !(toggled.has(a.id) ? !a.is_read : a.is_read)) && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 text-xs">
              <CheckCheck className="size-3.5" />
              전체 읽음
            </Button>
          )}
        </div>
      </div>

      {/* 필터 카드 */}
      <Card className="overflow-visible">
        <div className="h-0.5 w-full bg-slate-300 rounded-t-xl" />
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 items-start">
            {/* 사용자 선택 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">어르신</span>
              <select
                value={patientId || 'all'}
                onChange={(e) => setPatient(e.target.value === 'all' ? '' : e.target.value)}
                className="h-8 w-44 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 cursor-pointer"
              >
                <option value="all">전체</option>
                {patients?.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.name} ({p.patient_id})
                  </option>
                ))}
              </select>
            </div>

            {/* 소스 라디오 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">소스</span>
              <div className="flex gap-4 mt-1">
                {SOURCES.map((s) => (
                  <label
                    key={s.value}
                    className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name="source"
                      value={s.value}
                      checked={source === s.value}
                      onChange={() => setSource(s.value as AlertSource | '')}
                      className="accent-blue-500"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 레벨 필터 — 토글 버튼 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">레벨</span>
              <div className="flex gap-2 mt-1">
                {LEVELS.map((l) => {
                  const active = selectedLevels.includes(l.value);
                  return (
                    <button
                      key={l.value}
                      onClick={() => toggleLevel(l.value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${active ? l.activeClass : l.inactiveClass}`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 권한 없음 */}
      {isAccessDenied && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          이 사용자에 대한 권한이 없습니다.
        </div>
      )}

      {/* 네트워크/서버 에러 */}
      {error && !isAccessDenied && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
          <span>알림을 불러오는 중 오류가 발생했습니다.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {/* 날짜별 히스토리 뷰 */}
      {!error && viewMode === 'history' && (
        isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-24 bg-slate-200 rounded" />
                  <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                  <div className="flex-1 h-0.5 bg-slate-200 rounded" />
                </div>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : alertsByDate.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white animate-in fade-in duration-500">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
              <path d="M40 12 L58 18.5 L58 38 C58 50 50 57.5 40 62 C30 57.5 22 50 22 38 L22 18.5 Z"
                fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M30 39 L37 46 L51 31" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">알림이 없습니다</p>
              <p className="text-xs text-slate-400 mt-1">필터 조건을 변경하거나, 모든 어르신이 안전한 상태입니다</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {Array.from(alertsByDate.entries()).map(([date, items]) => (
              <div key={date}>
                {/* 날짜 헤더 */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">{date}</h3>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{items.length}건</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                {/* 알림 목록 */}
                <div className="space-y-2">
                  {items.map((alert, i) => {
                    const isRead = resolveRead(alert);
                    const name = patientMap[alert.patient_id] ?? alert.patient_id;
                    return (
                      <div
                        key={alert.id}
                        className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all duration-200 animate-in fade-in slide-in-from-left-1 ${historyCardClass[alert.level]} ${isRead ? 'opacity-50' : ''}`}
                        style={{ animationDelay: `${i * 25}ms` }}
                      >
                        <span className={`size-2.5 rounded-full shrink-0 ${levelDotClass[alert.level]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/${alert.patient_id}`)}
                              className="text-sm font-semibold text-slate-800 hover:text-blue-700 transition-colors"
                            >
                              {name} 어르신
                            </button>
                            <span className="text-slate-300">·</span>
                            <span className="text-sm text-slate-500">{alert.alert_type}</span>
                            <Badge variant="outline" className={`text-xs ${levelBadgeClass[alert.level]}`}>
                              {levelLabel[alert.level]}
                            </Badge>
                            {!isRead && (
                              <span className="text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none">NEW</span>
                            )}
                          </div>
                          {alert.message && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate" title={alert.message}>{alert.message}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400 whitespace-nowrap">{formatKST(alert.ts_utc)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRead(alert.id)}
                          title={isRead ? '미읽음으로 변경' : '읽음으로 변경'}
                          className="shrink-0 inline-flex items-center justify-center transition-colors"
                        >
                          {isRead
                            ? <CheckCircle2 className="size-5 text-green-500" />
                            : <Circle className="size-5 text-slate-300 hover:text-slate-500" />
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 테이블 */}
      {!error && viewMode === 'table' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시각</TableHead>
                  <TableHead>소스</TableHead>
                  <TableHead>레벨</TableHead>
                  <TableHead>어르신</TableHead>
                  <TableHead>디바이스</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="w-64">메시지</TableHead>
                  <TableHead className="w-16 text-center">읽음</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : alerts && alerts.length > 0
                  ? alerts.map((alert) => {
                      const isRead = resolveRead(alert);
                      return (
                        <TableRow
                          key={alert.id}
                          className={`${levelRowClass[alert.level]} ${isRead ? 'opacity-50' : ''}`}
                        >
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                            {formatKST(alert.ts_utc)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={sourceBadgeClass[alert.source]}
                            >
                              {sourceLabel[alert.source]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={levelBadgeClass[alert.level]}
                            >
                              {levelLabel[alert.level]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{patientMap[alert.patient_id] ?? alert.patient_id}</TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {alert.device_key}
                          </TableCell>
                          <TableCell className="text-sm">{alert.alert_type}</TableCell>
                          <TableCell className="w-64 max-w-xs">
                            <span
                              className="block truncate text-sm text-slate-700"
                              title={alert.message}
                            >
                              {alert.message}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => toggleRead(alert.id)}
                              title={isRead ? '미읽음으로 변경' : '읽음으로 변경'}
                              className="inline-flex items-center justify-center transition-colors"
                            >
                              {isRead
                                ? <CheckCircle2 className="size-5 text-green-500" />
                                : <Circle className="size-5 text-slate-300 hover:text-slate-500" />
                              }
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                            {/* 방패 + 체크 일러스트 */}
                            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="40" cy="40" r="36" fill="#f8fafc"/>
                              <circle cx="40" cy="40" r="36" stroke="#e2e8f0" strokeWidth="1"/>
                              <path
                                d="M40 12 L58 18.5 L58 38 C58 50 50 57.5 40 62 C30 57.5 22 50 22 38 L22 18.5 Z"
                                fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round"
                              />
                              <path
                                d="M30 39 L37 46 L51 31"
                                stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-semibold text-slate-500">알림이 없습니다</p>
                              <p className="text-xs text-slate-400 mt-1">필터 조건을 변경하거나, 어르신이 모두 안전한 상태입니다</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {/* 이벤트 이력 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">이벤트 이력</h2>
          {!isEventsLoading && (
            <span className="text-xs text-slate-400">{filteredEvents.length}건</span>
          )}
        </div>

        {isEventsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
            <p className="text-sm text-slate-400">이벤트 이력이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredEvents.map((event, i) => {
              const dot = eventSeverityDot(event.severity, event.event_type);
              const badge = eventSeverityBadge(event.severity, event.event_type);
              const name = patientMap[event.patient_id] ?? event.patient_id;
              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/dashboard/${event.patient_id}`)}
                  className="flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-3 text-left transition-all hover:shadow-sm hover:border-blue-200 animate-in fade-in"
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  <span className={`size-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{name} 어르신</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-sm text-slate-500">{translateEventType(event.event_type)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{formatKST(event.ts_utc)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
