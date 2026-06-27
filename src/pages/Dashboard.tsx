import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientList } from '@/hooks/usePatientList';
import { useAlerts } from '@/hooks/useAlerts';
import { useAllEvents } from '@/hooks/useAllEvents';
import { translateEventType, eventSeverityDot, eventSeverityBadge, eventLevelCategory } from '@/lib/event-labels';
import { riskScoreFromEvents, riskLevelFromScore } from '@/lib/risk';
import { formatKST } from '@/lib/format';
import {
  Users, ChevronRight,
  CheckCircle2, AlertCircle, XCircle, ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { AlertLevel } from '@/types/api';
import { useAuthUser } from '@/lib/auth-store';
import { useReadStore } from '@/lib/read-store';
import { useSeenStore } from '@/lib/seen-store';
import { useWhepStatus } from '@/hooks/useWhepStatus';

// ── constants ──────────────────────────────────────────────────────────────


// ── helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: string, now: number = Date.now()): string {
  const diff = now - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// 1분마다 현재 시각을 갱신 — 카드의 "n분 전" 텍스트 실시간 동기화
function useNow(ms = 60_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// 0 → target 카운트업 (easeOut cubic)
function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return count;
}

function elderStatus(level: AlertLevel | null) {
  if (!level) return {
    label: '안전',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    avatar: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-400',
    card: 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400',
  };
  if (level === 'critical') return {
    label: '위험',
    color: 'text-red-600 bg-red-50 border-red-200',
    avatar: 'bg-red-100 text-red-600',
    bar: 'bg-red-500',
    card: 'border-red-400 bg-red-50/70 hover:border-red-600 ring-2 ring-red-200',
  };
  if (level === 'high') return {
    label: '위험',
    color: 'text-red-600 bg-red-50 border-red-200',
    avatar: 'bg-red-100 text-red-600',
    bar: 'bg-red-400',
    card: 'border-red-300 bg-red-50/50 hover:border-red-500',
  };
  if (level === 'medium') return {
    label: '주의',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    avatar: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-400',
    card: 'border-amber-300 bg-amber-50/60 hover:border-amber-500',
  };
  return {
    label: '안전',
    color: 'text-green-600 bg-green-50 border-green-200',
    avatar: 'bg-green-100 text-green-700',
    bar: 'bg-green-400',
    card: 'border-green-200 bg-green-50/30 hover:border-green-400',
  };
}

function RiskGaugeBar({ score }: { score: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setActive(true), 60);
    return () => clearTimeout(id);
  }, []);

  const level      = riskLevelFromScore(score);
  const barColor   = level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-400' : 'bg-emerald-400';
  const scoreColor = level === 'high' ? 'text-red-600' : level === 'medium' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="mt-3">
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-[1500ms] ease-out ${barColor}`}
          style={{ width: active ? `${(score / 5) * 100}%` : '0%' }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-400">위험 점수</span>
        <span className={`text-[10px] font-bold tabular-nums ${scoreColor}`}>
          {score.toFixed(1)}<span className="font-normal text-slate-400">/5</span>
        </span>
      </div>
    </div>
  );
}

// ── patient card ───────────────────────────────────────────────────────────

interface PatientStat {
  id: string;
  name: string;
  count: number;
  highestLevel: AlertLevel | null;
  lastAlertTs: string | null;
  lastAnyAlertTs: string | null;
  lastEventTs: string | null;
  riskScore: number | null;
  riskScoreTs: string | null;
  status: string;
}

// 여러 시각 중 가장 최근(ISO 문자열) 반환
function latestTs(...values: (string | null)[]): string | null {
  const valid = values.filter((v): v is string => !!v);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

function PatientCard({ p, tick, index }: { p: PatientStat; tick: number; index: number }) {
  const navigate = useNavigate();
  const whepConnected = useWhepStatus(p.id);
  const st = elderStatus(p.highestLevel);

  // 활동 감지 시각 — 위험점수·이벤트·알림 중 가장 최근값 기준
  const activityTs = latestTs(p.riskScoreTs, p.lastEventTs, p.lastAnyAlertTs);
  const riskAge = activityTs ? tick - new Date(activityTs).getTime() : null;
  const cameraOnline   = whepConnected || (riskAge !== null && riskAge < 60 * 60 * 1000);
  const cameraUnstable = !cameraOnline && riskAge !== null && riskAge < 6 * 60 * 60 * 1000;
  const activityRecent = riskAge !== null && riskAge < 6 * 60 * 60 * 1000;

  const lastActivityAge = riskAge;
  const hasAnyHistory = activityTs !== null;
  const noActivity = hasAnyHistory && lastActivityAge !== null && lastActivityAge > 12 * 60 * 60 * 1000;
  // 하단 표시용 마지막 활동 시각 (이벤트/알림 우선)
  const lastSeenTs = latestTs(p.lastEventTs, p.lastAnyAlertTs, p.riskScoreTs);

  return (
    <button
      onClick={() => navigate(`/dashboard/${p.id}`)}
      className={`group text-left rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${st.card}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className={`h-1.5 w-full ${st.bar}`} />

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`size-14 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 ${st.avatar}`}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="12" r="6.5" fill="currentColor" opacity="0.72"/>
              <path d="M4 36 C4 26.6 10.3 21 18 21 C25.7 21 32 26.6 32 36" fill="currentColor" opacity="0.52"/>
              <line x1="29" y1="22" x2="33" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.38"/>
              <path d="M31 22 C31 22 33 21 34 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.38"/>
            </svg>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant="outline" className={`text-xs font-semibold ${st.color}`}>
              {st.label}
            </Badge>
            <span className={`flex items-center gap-1 text-[10px] font-medium ${
              cameraOnline ? 'text-emerald-500' :
              cameraUnstable ? 'text-amber-500' :
              'text-slate-400'
            }`}>
              <span className={`size-1.5 rounded-full ${
                cameraOnline ? 'bg-emerald-400 animate-pulse' :
                cameraUnstable ? 'bg-amber-400' :
                'bg-slate-300'
              }`} />
              {cameraOnline ? '연결됨' : cameraUnstable ? '연결 불안정' : '오프라인'}
            </span>
          </div>
        </div>

        <p className="text-base font-bold text-slate-800 group-hover:text-blue-800 transition-colors">
          {p.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{p.id}</p>
        {activityTs && (
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${activityRecent ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`size-1.5 rounded-full shrink-0 ${activityRecent ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
            {relativeTime(activityTs, tick)} 활동 감지됨
          </p>
        )}

        {noActivity && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5">
            <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-600 font-medium">장시간 활동 미감지</span>
          </div>
        )}

        {p.riskScore !== null && <RiskGaugeBar score={p.riskScore} />}

        {!lastSeenTs && cameraOnline && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
            <span className="text-emerald-500 font-medium">이상 없음</span>
          </div>
        )}
      </div>

      <div className="px-6 pb-5">
        <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-blue-500 transition-colors">
          <span>상태 확인</span>
          <ChevronRight className="size-3.5" />
        </div>
      </div>
    </button>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [activityFilter, setActivityFilter] = useState<'today' | 'week' | 'all'>('week');

  useEffect(() => {
    document.title = '어르신 안전 돌봄 서비스';
  }, []);

  const { data: patients, isLoading: isPatientsLoading } = usePatientList();
  const { data: allAlerts, isLoading: isAlertsLoading } = useAlerts();
  const { data: allEvents, isLoading: isEventsLoading } = useAllEvents(200);
  const readIds = useReadStore((s) => s.readIds);
  const seenAt = useSeenStore((s) => s.seenAt);

  const patientMap = useMemo(() => {
    if (!patients) return {} as Record<string, string>;
    return Object.fromEntries(patients.map(p => [p.patient_id, p.name]));
  }, [patients]);

  const patientStats = useMemo(() => {
    if (!patients) return null;
    const levels: AlertLevel[] = ['critical', 'high', 'medium', 'low'];
    return patients.map(p => {
      const pa = allAlerts?.filter(a => a.patient_id === p.patient_id && !a.is_read && !readIds.includes(a.id)) ?? [];
      const allPa = allAlerts?.filter(a => a.patient_id === p.patient_id) ?? [];
      const pe = allEvents?.filter(e => e.patient_id === p.patient_id) ?? [];
      const alertHighestLevel = levels.find(l => pa.some(a => a.level === l)) ?? null;

      // 카드 등급/점수 = 통일 기준(위험점수). 백엔드 분석값 우선, 없으면 최근 이벤트 평균.
      const unifiedScore = riskScoreFromEvents(pe);
      const scoreLevel: AlertLevel | null = unifiedScore != null ? riskLevelFromScore(unifiedScore) : null;
      // 점수가 전혀 없을 때만 미읽음 알림 등급으로 폴백
      const highestLevel: AlertLevel | null = scoreLevel ?? alertHighestLevel;
      const lastAlertTs = pa.length > 0
        ? pa.reduce((a, b) => new Date(a.ts_utc) > new Date(b.ts_utc) ? a : b).ts_utc
        : null;
      const lastAnyAlertTs = allPa.length > 0
        ? allPa.reduce((a, b) => new Date(a.ts_utc) > new Date(b.ts_utc) ? a : b).ts_utc
        : null;
      const lastEventTs = pe.length > 0
        ? pe.reduce((a, b) => new Date(a.ts_utc) > new Date(b.ts_utc) ? a : b).ts_utc
        : null;
      return {
        id: p.patient_id,
        name: p.name,
        count: pa.length,
        highestLevel,
        lastAlertTs,
        lastAnyAlertTs,
        lastEventTs,
        riskScore: unifiedScore,
        riskScoreTs: lastEventTs,
        status: p.status,
      };
    });
  }, [patients, allAlerts, allEvents, readIds]);

  const recentEvents = useMemo(() => {
    if (!allEvents) return [];
    const now = Date.now();
    return [...allEvents]
      .filter(e => {
        if (activityFilter === 'today') return now - new Date(e.ts_utc).getTime() < 24 * 60 * 60 * 1000;
        if (activityFilter === 'week')  return now - new Date(e.ts_utc).getTime() < 7 * 24 * 60 * 60 * 1000;
        return true;
      })
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
      .slice(0, 20);
  }, [allEvents, activityFilter]);

  const totalPatients  = patients?.length ?? 0;
  // 위험 알림 = 최근 7일 위험(낙상 등) 감지 사건 수 — 최근 감지 목록·차트의 위험과 일치
  const criticalAlerts = allEvents?.filter(e =>
    Date.now() - new Date(e.ts_utc).getTime() < 7 * 24 * 60 * 60 * 1000 &&
    eventLevelCategory(e) === 'danger'
  ).length ?? 0;
  // 미읽음 알림 = 위험 사건 중 아직 확인하지 않은 것 (벨/알림 페이지 확인 시 줄어듦)
  const seenMs = seenAt ? new Date(seenAt).getTime() : 0;
  const unreadAlerts   = allEvents?.filter(e =>
    Date.now() - new Date(e.ts_utc).getTime() < 7 * 24 * 60 * 60 * 1000 &&
    eventLevelCategory(e) === 'danger' &&
    new Date(e.ts_utc).getTime() > seenMs
  ).length ?? 0;
  const isLoading      = isPatientsLoading || isAlertsLoading;

  const tick           = useNow();
  const countPatients  = useCountUp(isLoading ? 0 : totalPatients);
  const countUnread    = useCountUp(isLoading ? 0 : unreadAlerts);
  const countCritical  = useCountUp(isLoading ? 0 : criticalAlerts);

  // 영웅 상태 = 어르신 카드 등급(알림·위험점수·최근 감지 통합) 중 최고 등급 기준
  const overallStatus = (patientStats?.some(p => p.highestLevel === 'critical' || p.highestLevel === 'high'))
    ? 'critical'
    : (patientStats?.some(p => p.highestLevel === 'medium') ? 'warning' : 'safe');

  const heroGradient = overallStatus === 'critical'
    ? 'from-red-900 via-red-800 to-rose-900'
    : overallStatus === 'warning'
    ? 'from-amber-800 via-amber-700 to-orange-800'
    : 'from-blue-900 via-blue-800 to-indigo-900';

  const statusConfig = {
    safe: {
      Icon: CheckCircle2,
      iconClass: 'text-emerald-400',
      bgClass: 'bg-emerald-400/20',
      message: '현재 위험 알림이 없습니다',
      sub: '모든 어르신이 안정적인 상태입니다',
    },
    warning: {
      Icon: AlertCircle,
      iconClass: 'text-amber-400',
      bgClass: 'bg-amber-400/20',
      message: '주의가 필요한 어르신이 있습니다',
      sub: '알림을 확인해 주세요',
    },
    critical: {
      Icon: XCircle,
      iconClass: 'text-red-300',
      bgClass: 'bg-red-400/20',
      message: '위험 상황이 감지되었습니다',
      sub: '즉시 확인이 필요합니다',
    },
  }[overallStatus];

  const { Icon: StatusIcon } = statusConfig;

  const greeting = new Date().getHours() < 12 ? '좋은 아침이에요' : '안녕하세요';

  return (
    <div className="bg-white">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${heroGradient} text-white transition-colors duration-700`}>
        <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-white/5" style={{ animation: 'hero-blob-a 16s ease-in-out infinite' }} />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 size-80 rounded-full bg-white/5" style={{ animation: 'hero-blob-b 11s ease-in-out infinite' }} />
        <div className="pointer-events-none absolute -left-28 top-1/2 size-[380px] rounded-full bg-white/[0.03]" style={{ animation: 'hero-blob-c 19s ease-in-out infinite' }} />

        {/* ── 우측 장식 레이어 ── */}
        <div className="pointer-events-none absolute inset-0">
          {/* 점 패턴 */}
          <div
            className="absolute right-0 top-0 h-full w-5/12"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)',
              backgroundSize: '22px 22px',
              maskImage: 'linear-gradient(to left, rgba(0,0,0,0.5) 0%, transparent 100%)',
            }}
          />
          {/* 원형 장식 1 — 최외곽 링 */}
          <div className="absolute right-[-150px] top-1/2 -translate-y-1/2 size-[520px] rounded-full border border-white/10" />
          {/* 원형 장식 2 — 중간 링 */}
          <div className="absolute right-[-80px] top-1/2 -translate-y-1/2 size-[350px] rounded-full border border-white/[0.13] bg-white/[0.03]" />
          {/* 원형 장식 3 — 내부 채움 */}
          <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 size-[200px] rounded-full bg-white/[0.055]" />
          {/* 방패 실루엣 */}
          <svg
            className="absolute right-[38px] top-1/2 -translate-y-1/2 opacity-[0.11]"
            width="120" height="136" viewBox="0 0 30 34" fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 1 L28 5.8 L28 17 C28 26 22 31.5 15 34 C8 31.5 2 26 2 17 L2 5.8 Z"
              fill="white"
            />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="flex flex-col items-center text-center gap-6">

            {/* 상태 아이콘 */}
            {isLoading ? (
              <Skeleton className="size-20 rounded-full bg-white/20" />
            ) : (
              <div className="relative flex items-center justify-center">
                {/* 소나 핑 */}
                <div className="absolute size-20 rounded-full bg-white/20" style={{ animation: 'sonar 2.8s ease-out infinite' }} />
                <div className="absolute size-20 rounded-full bg-white/14" style={{ animation: 'sonar 2.8s ease-out 0.93s infinite' }} />
                <div className="absolute size-20 rounded-full bg-white/8"  style={{ animation: 'sonar 2.8s ease-out 1.86s infinite' }} />
                <div className={`relative flex size-20 items-center justify-center rounded-full ${statusConfig.bgClass} ring-4 ring-white/10`}>
                  <StatusIcon className={`size-10 ${statusConfig.iconClass}`} />
                </div>
              </div>
            )}

            {/* 메인 상태 메시지 */}
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-80 bg-white/20 mx-auto" />
                <Skeleton className="h-5 w-48 bg-white/20 mx-auto" />
              </div>
            ) : (
              <div>
                <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                  {statusConfig.message}
                </h1>
                <p className="mt-2 text-white/60 text-base">{statusConfig.sub}</p>
              </div>
            )}

            {/* 보호자 인사말 */}
            <p className="text-white/50 text-sm">
              {greeting},{' '}
              <span className="text-white/80 font-semibold">{user?.email.split('@')[0]}</span> {user?.role === 'admin' ? '관리자님' : '보호자님'}
            </p>

            {/* 빠른 통계 */}
            {isLoading ? (
              <div className="flex divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm overflow-hidden mt-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="px-8 py-3 text-center space-y-1.5">
                    <Skeleton className="h-8 w-10 bg-white/20 mx-auto" />
                    <Skeleton className="h-3 w-14 bg-white/20 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm overflow-hidden mt-2">
                <div className="px-8 py-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums">{countPatients}</p>
                  <p className="text-xs text-white/60 mt-0.5">어르신</p>
                </div>
                <div className="px-8 py-3 text-center">
                  <p className={`text-2xl font-extrabold tabular-nums ${unreadAlerts > 0 ? 'text-amber-300' : ''}`}>
                    {countUnread}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">미읽음 알림</p>
                </div>
                <div className="px-8 py-3 text-center">
                  <p className={`text-2xl font-extrabold tabular-nums ${criticalAlerts > 0 ? 'text-red-300' : ''}`}>
                    {countCritical}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">위험 알림</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 어르신 현황 ──────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div className="border-l-[3px] border-blue-500 pl-4">
            <h2 className="text-2xl font-bold text-slate-800">어르신 현황</h2>
            <p className="text-sm text-slate-400 mt-1">선택하면 실시간 영상과 상세 정보를 확인할 수 있습니다</p>
          </div>
          {patients && patients.length > 0 && (
            <span className="text-sm text-slate-400">{patients.length}명</span>
          )}
        </div>

        {isPatientsLoading ? (
          <div className="grid grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : !patients || patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50">
            <Users className="size-12 text-slate-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500">연결된 어르신이 없습니다</p>
              <p className="text-xs text-slate-400 mt-1">관리자에게 문의하세요</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {(patientStats ?? patients.map(p => ({
              id: p.patient_id, name: p.name, count: 0,
              highestLevel: null, lastAlertTs: null, lastAnyAlertTs: null, lastEventTs: null,
              riskScore: null, riskScoreTs: null, status: p.status,
            }))).map((p, i) => (
              <PatientCard key={p.id} p={p} tick={tick} index={i} />
            ))}
          </div>
        )}
        </div>
      </section>

      {/* ── 최근 활동 피드 ───────────────────────────────────────── */}
      {patients && patients.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="flex items-center justify-between mb-8">
              <div className="border-l-[3px] border-blue-500 pl-4">
                <h2 className="text-2xl font-bold text-slate-800">최근 활동</h2>
                <p className="text-sm text-slate-400 mt-1">최근 발생한 알림 및 이벤트</p>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg bg-slate-200 p-0.5">
                {(['today', 'week', 'all'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivityFilter(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      activityFilter === key
                        ? 'bg-white text-slate-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {key === 'today' ? '오늘' : key === 'week' ? '이번 주' : '전체'}
                  </button>
                ))}
              </div>
            </div>

            {isEventsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white animate-in fade-in duration-500">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="36" cy="36" r="32" fill="#f8fafc"/>
                  <path
                    d="M36 11 L52 17 L52 34 C52 44.5 45 51.5 36 55.5 C27 51.5 20 44.5 20 34 L20 17 Z"
                    fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round"
                  />
                  <path
                    d="M28 35 L33.5 40.5 L45 29"
                    stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                  />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-500">최근 활동이 없습니다</p>
                  <p className="text-xs text-slate-400 mt-1">모든 어르신이 안전한 상태입니다</p>
                </div>
              </div>
            ) : (
              <div className="max-h-[470px] overflow-y-auto pr-1">
              <div className="relative">
                {/* 타임라인 세로선 */}
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-slate-200" />

                <div className="space-y-4">
                  {recentEvents.map((event, i) => {
                    const dot = eventSeverityDot(event);
                    const badge = eventSeverityBadge(event);
                    const name = patientMap[event.patient_id] ?? event.patient_id;

                    return (
                      <button
                        key={event.id}
                        onClick={() => navigate(`/dashboard/${event.patient_id}`)}
                        className="relative flex items-start gap-4 pl-10 w-full text-left animate-in fade-in slide-in-from-left-2 duration-300"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        {/* 타임라인 점 */}
                        <span className={`absolute left-[14px] top-[18px] size-2.5 rounded-full ring-2 ring-slate-50 ${dot}`} />

                        <div className="flex-1 rounded-2xl border bg-white px-5 py-4 transition-shadow hover:shadow-md hover:border-blue-200 cursor-pointer border-slate-100">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-800">{name}</span>
                                <span className="text-sm text-slate-600">·</span>
                                <span className="text-sm text-slate-600">{translateEventType(event.event_type)}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <Badge variant="outline" className={`text-xs ${badge.color}`}>
                                {badge.label}
                              </Badge>
                              <span
                                className="text-[11px] text-slate-400"
                                title={formatKST(event.ts_utc)}
                              >
                                {relativeTime(event.ts_utc, tick)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 푸터 ──────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
          {/* 브랜드 */}
          <div className="flex items-center gap-2.5 pb-6 border-b border-slate-800">
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-600/25">
              <ShieldCheck className="size-4 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white">어르신 안전 돌봄 서비스</span>
            <p className="text-xs text-slate-600 ml-2">독거노인 안전을 위한 AI 기반 실시간 모니터링 시스템</p>
          </div>

          {/* 하단 바 */}
          <div className="pt-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              실시간 모니터링 가동 중
            </div>
            <p className="text-xs text-slate-600">© 2025 어르신 안전 돌봄 서비스</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
