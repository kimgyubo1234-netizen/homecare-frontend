import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Circle, CheckCheck, ChevronLeft } from 'lucide-react';
import { useAllEvents } from '@/hooks/useAllEvents';
import { usePatientList } from '@/hooks/usePatientList';
import { useReadStore } from '@/lib/read-store';
import { useSeenStore } from '@/lib/seen-store';
import { formatKST } from '@/lib/format';
import { translateEventType, eventLevelCategory } from '@/lib/event-labels';
import type { SeverityCategory } from '@/lib/event-labels';
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
import type { IncidentEvent } from '@/types/api';

// 사건(incident) 위험도 3단계 — 유형 기준 분류(event-labels)와 동일
const CATEGORIES: { value: SeverityCategory; label: string; activeClass: string; inactiveClass: string }[] = [
  { value: 'danger',  label: '위험', activeClass: 'bg-red-500 text-white border-red-500',       inactiveClass: 'bg-white text-red-500 border-red-300 hover:bg-red-50' },
  { value: 'warning', label: '주의', activeClass: 'bg-yellow-400 text-white border-yellow-400', inactiveClass: 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50' },
  { value: 'safe',    label: '안전', activeClass: 'bg-green-500 text-white border-green-500',    inactiveClass: 'bg-white text-green-600 border-green-300 hover:bg-green-50' },
];

const catBadgeClass: Record<SeverityCategory, string> = {
  danger:  'bg-red-100 text-red-600 border-red-200',
  warning: 'bg-yellow-100 text-yellow-600 border-yellow-200',
  safe:    'bg-green-100 text-green-600 border-green-200',
};

const catDotClass: Record<SeverityCategory, string> = {
  danger:  'bg-red-500 animate-pulse',
  warning: 'bg-amber-400',
  safe:    'bg-emerald-400',
};

const catRowClass: Record<SeverityCategory, string> = {
  danger:  'border-l-2 border-l-red-500',
  warning: 'border-l-2 border-l-yellow-400',
  safe:    'border-l-2 border-l-green-400',
};

const catCardClass: Record<SeverityCategory, string> = {
  danger:  'border-red-200 bg-red-50/40',
  warning: 'border-amber-100 bg-amber-50/20',
  safe:    'border-slate-100 bg-white',
};

const catLabel: Record<SeverityCategory, string> = {
  danger: '위험',
  warning: '주의',
  safe: '안전',
};

function incidentDetail(e: IncidentEvent): string {
  const parts: string[] = [];
  if (typeof e.duration_sec === 'number' && e.duration_sec > 0) parts.push(`${Math.round(e.duration_sec)}초 지속`);
  if (typeof e.raw_event_count === 'number' && e.raw_event_count > 0) parts.push(`${e.raw_event_count}회 감지`);
  return parts.join(' · ');
}

export default function Alerts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = '독거노인 안전 모니터링 - 알림';
  }, []);

  const patientId = searchParams.get('patient_id') ?? '';
  const levelsParam = searchParams.get('levels') ?? '';
  const selectedCats: SeverityCategory[] = levelsParam
    ? (levelsParam.split(',') as SeverityCategory[])
    : [];

  const { data: patients } = usePatientList();
  const { data: incidents, isLoading, error, refetch } = useAllEvents(200);

  const [viewMode, setViewMode] = useState<'history' | 'table'>('history');
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const markRead = useReadStore((s) => s.markRead);
  const readIds = useReadStore((s) => s.readIds);
  const markSeen = useSeenStore((s) => s.markSeen);

  // 페이지 방문 시 벨 배지 확인 처리
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  const patientMap = useMemo(() => {
    if (!patients) return {} as Record<string, string>;
    return Object.fromEntries(patients.map(p => [p.patient_id, p.name]));
  }, [patients]);

  const filtered = useMemo(() => {
    if (!incidents) return [];
    return [...incidents]
      .filter(e => !patientId || e.patient_id === patientId)
      .filter(e => selectedCats.length === 0 || selectedCats.includes(eventLevelCategory(e)))
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime());
  }, [incidents, patientId, selectedCats]);

  const byDate = useMemo(() => {
    const map = new Map<string, IncidentEvent[]>();
    for (const e of filtered) {
      const key = new Date(e.ts_utc).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      });
      const existing = map.get(key);
      if (existing) existing.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [filtered]);

  function resolveRead(id: number): boolean {
    const base = readIds.includes(id);
    return toggled.has(id) ? !base : base;
  }

  function toggleRead(id: number) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markAllRead() {
    const unreadIds = filtered.filter(e => !resolveRead(e.id)).map(e => e.id);
    markRead(unreadIds);
    markSeen();
    setToggled(new Set());
  }

  const unreadCount = filtered.filter(e => !resolveRead(e.id)).length;
  const hasUnread = unreadCount > 0;

  function setPatient(val: string) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('patient_id', val);
    else next.delete('patient_id');
    setSearchParams(next);
  }

  function toggleCat(cat: SeverityCategory) {
    const next = new URLSearchParams(searchParams);
    const current = selectedCats.includes(cat)
      ? selectedCats.filter((c) => c !== cat)
      : [...selectedCats, cat];
    if (current.length > 0) next.set('levels', current.join(','));
    else next.delete('levels');
    setSearchParams(next);
  }

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
              {!isLoading && filtered.length > 0 && (
                <Badge variant="secondary" className="text-xs">{filtered.length}건</Badge>
              )}
              {hasUnread && (
                <Badge className="bg-red-500 hover:bg-red-500 text-white text-xs">{unreadCount} 미읽음</Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">감지된 사건 이력</p>
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
          {hasUnread && (
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
          <div className="grid grid-cols-2 gap-6 items-start">
            {/* 어르신 선택 */}
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

            {/* 위험도 필터 — 토글 버튼 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">위험도</span>
              <div className="flex gap-2 mt-1">
                {CATEGORIES.map((c) => {
                  const active = selectedCats.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      onClick={() => toggleCat(c.value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${active ? c.activeClass : c.inactiveClass}`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
          <span>사건 이력을 불러오는 중 오류가 발생했습니다.</span>
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
                  <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                  <div className="flex-1 h-0.5 bg-slate-200 rounded" />
                </div>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : byDate.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white animate-in fade-in duration-500">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
              <path d="M40 12 L58 18.5 L58 38 C58 50 50 57.5 40 62 C30 57.5 22 50 22 38 L22 18.5 Z"
                fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M30 39 L37 46 L51 31" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">감지된 사건이 없습니다</p>
              <p className="text-xs text-slate-400 mt-1">필터 조건을 변경하거나, 모든 어르신이 안전한 상태입니다</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {Array.from(byDate.entries()).map(([date, items]) => (
              <div key={date}>
                {/* 날짜 헤더 */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">{date}</h3>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{items.length}건</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                {/* 사건 목록 */}
                <div className="space-y-2">
                  {items.map((e, i) => {
                    const cat = eventLevelCategory(e);
                    const isRead = resolveRead(e.id);
                    const name = patientMap[e.patient_id] ?? e.patient_id;
                    const detail = incidentDetail(e);
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all duration-200 animate-in fade-in slide-in-from-left-1 ${catCardClass[cat]} ${isRead ? 'opacity-50' : ''}`}
                        style={{ animationDelay: `${i * 25}ms` }}
                      >
                        <span className={`size-2.5 rounded-full shrink-0 ${catDotClass[cat]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/${e.patient_id}`)}
                              className="text-sm font-semibold text-slate-800 hover:text-blue-700 transition-colors"
                            >
                              {name}
                            </button>
                            <span className="text-slate-300">·</span>
                            <span className="text-sm text-slate-500">{translateEventType(e.event_type)}</span>
                            <Badge variant="outline" className={`text-xs ${catBadgeClass[cat]}`}>
                              {catLabel[cat]}
                            </Badge>
                            {!isRead && (
                              <span className="text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none">NEW</span>
                            )}
                          </div>
                          {detail && (
                            <p className="text-xs text-slate-400 mt-0.5">{detail}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400 whitespace-nowrap">{formatKST(e.ts_utc)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRead(e.id)}
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

      {/* 테이블 뷰 */}
      {!error && viewMode === 'table' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시각</TableHead>
                  <TableHead>위험도</TableHead>
                  <TableHead>어르신</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>상세</TableHead>
                  <TableHead className="w-16 text-center">읽음</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.length > 0
                  ? filtered.map((e) => {
                      const cat = eventLevelCategory(e);
                      const isRead = resolveRead(e.id);
                      return (
                        <TableRow key={e.id} className={`${catRowClass[cat]} ${isRead ? 'opacity-50' : ''}`}>
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatKST(e.ts_utc)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={catBadgeClass[cat]}>{catLabel[cat]}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{patientMap[e.patient_id] ?? e.patient_id}</TableCell>
                          <TableCell className="text-sm">{translateEventType(e.event_type)}</TableCell>
                          <TableCell className="text-sm text-slate-500">{incidentDetail(e) || '-'}</TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => toggleRead(e.id)}
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
                        <TableCell colSpan={6} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="40" cy="40" r="36" fill="#f8fafc"/>
                              <circle cx="40" cy="40" r="36" stroke="#e2e8f0" strokeWidth="1"/>
                              <path d="M40 12 L58 18.5 L58 38 C58 50 50 57.5 40 62 C30 57.5 22 50 22 38 L22 18.5 Z"
                                fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round"/>
                              <path d="M30 39 L37 46 L51 31" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                            <div>
                              <p className="text-sm font-semibold text-slate-500">감지된 사건이 없습니다</p>
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
    </div>
  );
}
