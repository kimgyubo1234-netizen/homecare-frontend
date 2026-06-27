import { useEffect, useMemo, useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDashboard } from '@/hooks/useDashboard';
import { useAlerts } from '@/hooks/useAlerts';
import { useReadStore } from '@/lib/read-store';
import { useAuthUser } from '@/lib/auth-store';
import { usePatientList } from '@/hooks/usePatientList';
import { ForbiddenError, NotFoundError } from '@/lib/api';
import { formatKST, formatAge } from '@/lib/format';
import VideoPlayer from '@/components/VideoPlayer';
import ActionOverlayPanel from '@/components/streaming/ActionOverlayPanel';
import { useActionPolling } from '@/hooks/useActionPolling';
import {
  ArrowLeft, User, Users, Calendar, Heart,
  Activity, AlertTriangle, UserX, Zap, Eye, Clock,
  ChevronLeft, ChevronRight, Bell, Phone, Printer, Play,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { RiskLevel, RiskScore, IncidentEvent, Clip } from '@/types/api';
import { usePatientEvents } from '@/hooks/usePatientEvents';
import { useClips } from '@/hooks/useClips';
import ClipsCard from '@/components/ClipsCard';
import ClipPlayerModal from '@/components/ClipPlayerModal';
import { eventLevelCategory } from '@/lib/event-labels';
import type { SeverityCategory } from '@/lib/event-labels';
import { riskScoreFromEvents, riskLevelFromScore } from '@/lib/risk';

// 알림 분석 차트용 정규화 타입 — 위험점수 기준 3단계(안전/주의/위험)
interface AnalysisItem { ts_utc: string; type: string; cat: SeverityCategory; }

// 위험점수 분석 데이터가 없을 때, 최근 액션 이벤트 risk_score 평균으로 추정 (공통 기준 사용)
function riskFromRecentEvents(events: IncidentEvent[], patientId: string): RiskScore | null {
  const score = riskScoreFromEvents(events);
  if (score === null || events.length === 0) return null;
  const latestTs = [...events]
    .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())[0].ts_utc;
  return {
    id: -1,
    patient_id: patientId,
    score,
    risk_level: riskLevelFromScore(score),
    reason: '최근 행동 분석 평균',
    analyzed_from_utc: null,
    analyzed_to_utc: null,
    created_at_utc: latestTs,
  };
}

// 사건(이벤트)에 대응하는 영상 클립 찾기 — 같은 어르신·유형 + 발생시각 근접(10분 이내)
function findClipForEvent(ev: IncidentEvent, clips: Clip[] | undefined): Clip | null {
  if (!clips || clips.length === 0) return null;
  const evMs = new Date(ev.ts_utc).getTime();
  const WINDOW = 10 * 60 * 1000;
  let best: Clip | null = null;
  let bestDiff = Infinity;
  for (const c of clips) {
    if (c.patient_id !== ev.patient_id || c.event_type !== ev.event_type) continue;
    const diff = Math.abs(new Date(c.occurred_at_utc).getTime() - evMs);
    if (diff <= WINDOW && diff < bestDiff) { best = c; bestDiff = diff; }
  }
  return best;
}

function eventToAnalysis(e: IncidentEvent): AnalysisItem {
  // 유형 기준 분류: 낙상=위험 / 비정상=주의 / 정상=안전
  return { ts_utc: e.ts_utc, type: e.event_type, cat: eventLevelCategory(e) };
}

// ── constants ──────────────────────────────────────────────────────────────

const riskBadgeClass: Record<RiskLevel, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const riskCardClass: Record<RiskLevel, string> = {
  high: 'border-red-300 bg-gradient-to-b from-red-50 to-white ring-1 ring-red-200',
  medium: 'border-yellow-200 bg-gradient-to-b from-yellow-50 to-white',
  low: 'border-green-200 bg-gradient-to-b from-green-50 to-white',
};

const riskStrokeColor: Record<RiskLevel, string> = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#22c55e',
};

const riskLevelLabel: Record<RiskLevel, string> = {
  high: '위험',
  medium: '주의',
  low: '안전',
};


// ── helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function severityBorderClass(cat: SeverityCategory): string {
  // 카테고리별 전체 테두리 + 옅은 배경색 — 위험(빨강)/주의(노랑)/안전(초록)
  if (cat === 'danger') return 'border-red-300 bg-red-50';
  if (cat === 'warning') return 'border-amber-300 bg-amber-50';
  return 'border-emerald-300 bg-emerald-50';
}

const HEATMAP_BLOCK_LABELS = ['00-03시', '04-07시', '08-11시', '12-15시', '16-19시', '20-23시'];

function buildHeatmapData(alerts: AnalysisItem[]) {
  const today = new Date();
  const dayKeys: string[] = [];
  const dayWeekLabels: string[] = [];
  const dayDateLabels: string[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }));
    dayWeekLabels.push(d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }));
    dayDateLabels.push(d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }));
  }

  // grid[block 0-5][day 0-6] = { count, typeCounts }
  const grid: { count: number; typeCounts: Record<string, number> }[][] =
    Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ count: 0, typeCounts: {} })));

  for (const alert of alerts) {
    const dayKey = new Date(alert.ts_utc).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
    });
    const dayIdx = dayKeys.indexOf(dayKey);
    if (dayIdx < 0) continue;
    const kstHour = new Date(new Date(alert.ts_utc).getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    const cell = grid[Math.floor(kstHour / 4)][dayIdx];
    cell.count++;
    const ko = translateEventType(alert.type);
    cell.typeCounts[ko] = (cell.typeCounts[ko] ?? 0) + 1;
  }

  return { dayWeekLabels, dayDateLabels, grid };
}

function heatCellClass(count: number): string {
  if (count === 0) return 'bg-slate-100 text-slate-100';
  if (count === 1) return 'bg-amber-100 text-amber-700';
  if (count <= 3) return 'bg-amber-300 text-amber-900';
  if (count <= 6) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

function buildHourlyData(alerts: AnalysisItem[]) {
  const slots: { hour: number; items: { type: string; cat: SeverityCategory }[] }[] =
    Array.from({ length: 24 }, (_, h) => ({ hour: h, items: [] }));

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().slice(0, 10);

  for (const a of alerts) {
    const kst = new Date(new Date(a.ts_utc).getTime() + 9 * 60 * 60 * 1000);
    if (kst.toISOString().slice(0, 10) !== todayStr) continue;
    slots[kst.getUTCHours()].items.push({ type: a.type, cat: a.cat });
  }

  return slots;
}

function buildChartData(alerts: AnalysisItem[]) {
  const entries: { date: string; safe: number; warning: number; danger: number; typeCounts: Record<string, number> }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    entries.push({
      date: d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }),
      safe: 0, warning: 0, danger: 0, typeCounts: {},
    });
  }
  for (const alert of alerts) {
    const key = new Date(alert.ts_utc).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
    });
    const entry = entries.find(e => e.date === key);
    if (entry) {
      entry[alert.cat]++;
      const ko = translateEventType(alert.type);
      entry.typeCounts[ko] = (entry.typeCounts[ko] ?? 0) + 1;
    }
  }
  return entries;
}

const EVENT_TYPE_KO: Record<string, string> = {
  fall: '낙상',
  fall_detected: '낙상 감지',
  fall_risk: '낙상 위험',
  abnormal_posture: '비정상 자세',
  abnormal_motion: '비정상 움직임',
  normal_activity: '정상 활동',
  normal_activity_summary: '정상 활동',
  no_activity: '활동 없음',
  inactive: '비활동 감지',
  motion_detected: '움직임 감지',
  risk_score_high: '위험점수 상승',
  long_inactivity: '장시간 비활동',
  activity: '활동 감지',
  backend_integration_test: '연동 테스트',
  backend_self_test: '자체 점검',
};

function translateEventType(type: string): string {
  return EVENT_TYPE_KO[type] ?? type;
}

function getEventIcon(eventType: string): LucideIcon {
  const lower = eventType.toLowerCase();
  if (lower.includes('fall') || lower.includes('낙상')) return AlertTriangle;
  if (lower.includes('inactive') || lower.includes('no_activity') || lower.includes('비활동')) return UserX;
  if (lower.includes('abnormal') || lower.includes('이상')) return Zap;
  if (lower.includes('detect') || lower.includes('감지')) return Eye;
  if (lower.includes('activity') || lower.includes('활동')) return Activity;
  return Clock;
}

// ── sub-components ─────────────────────────────────────────────────────────

function ElderAvatar({ size = 72, color = 'rgba(255,255,255,0.7)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="24" r="13" fill={color} opacity="0.72" />
      <path d="M8 72 C8 53.2 20.6 42 36 42 C51.4 42 64 53.2 64 72" fill={color} opacity="0.52" />
      <line x1="58" y1="44" x2="66" y2="70" stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.38" />
      <path d="M60 44 C60 44 65 42 67 44" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.38" />
    </svg>
  );
}

function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const [animated, setAnimated] = useState(false);
  const r = 54, cx = 68, cy = 68;
  const arcLength = Math.PI * r;
  const MAX = 5;
  const clampedScore = Math.min(score, MAX * 0.999);
  const theta = ((MAX - clampedScore) / MAX) * Math.PI;
  const endX = (cx + r * Math.cos(theta)).toFixed(2);
  const endY = (cy - r * Math.sin(theta)).toFixed(2);
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const scorePath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
  const color = riskStrokeColor[level];
  const filled = (clampedScore / MAX) * arcLength;

  useEffect(() => {
    setAnimated(false);
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [score]);

  return (
    <svg viewBox="0 0 136 80" className="w-full max-w-[240px] mx-auto">
      <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
      {score > 0 && (
        <path
          d={scorePath}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={animated ? arcLength - filled : arcLength}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      )}
      <text x={cx} y={54} textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>{score.toFixed(1)}</text>
      <text x={cx} y={70} textAnchor="middle" fontSize="11" fill="#94a3b8">/ 5</text>
    </svg>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const filtered = payload.filter(p => p.value > 0);
  if (!filtered.length) return null;
  const total = filtered.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {filtered.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-medium text-slate-700">{p.value}건</span>
        </div>
      ))}
      {filtered.length > 1 && (
        <div className="pt-1 border-t border-slate-100 font-semibold text-slate-700 flex justify-between">
          <span>합계</span><span>{total}건</span>
        </div>
      )}
    </div>
  );
}


function RiskSegmentBar({ score }: { score: number }) {
  // 구간 폭(%)을 등급 경계(안전<3 / 주의 3~5 / 위험 5)에 맞춰 마커를 배치 →
  // 마커가 항상 자기 등급 색 구간 안에 위치하도록 보장한다.
  const SAFE_W = 40, WARN_W = 40; // 위험 구간 20%
  const level = riskLevelFromScore(score);
  let pct: number;
  if (score < 3)       pct = (Math.max(0, score) / 3) * SAFE_W;             // 안전 구간 내
  else if (score < 5)  pct = SAFE_W + ((score - 3) / 2) * WARN_W;          // 주의 구간 내
  else                 pct = 100;                                           // 위험
  pct = Math.min(Math.max(pct, 0), 100);
  const markerColor = level === 'high' ? '#ef4444' : level === 'medium' ? '#f97316' : '#22c55e';
  return (
    <div className="mt-3 space-y-1.5">
      <div className="relative h-3">
        <div className="flex h-full rounded-full overflow-hidden">
          <div style={{ width: '40%' }} className="bg-green-400/70" />
          <div style={{ width: '40%' }} className="bg-orange-400/70" />
          <div style={{ width: '20%' }} className="bg-red-400/70" />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-4 rounded-full ring-2 ring-white shadow-md transition-all duration-700"
          style={{ left: `${pct}%`, backgroundColor: markerColor }}
        />
      </div>
      <div className="flex text-[10px] font-medium">
        <span style={{ width: '40%' }} className="text-center text-green-600">안전 (1~2)</span>
        <span style={{ width: '40%' }} className="text-center text-orange-500">주의 (3~4)</span>
        <span style={{ width: '20%' }} className="text-center text-red-500">위험 (5)</span>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 animate-in fade-in duration-500">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="24" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
        <path d="M28 8 L40 13 L40 27 C40 35 35 40 28 43 C21 40 16 35 16 27 L16 13 Z"
          fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M22 28 L26.5 32.5 L35 23" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-500">{message}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function PatientDetail() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const authUser = useAuthUser();
  const isGuardian = authUser?.role === 'guardian';
  const [chartTab, setChartTab] = useState<'trend' | 'activity' | 'heatmap'>('trend');

  useEffect(() => {
    document.title = `어르신 안전 돌봄 서비스 — ${patientId}`;
  }, [patientId]);

  const { data: dashboard, isLoading, error } = useDashboard(patientId);
  const { latestEvent, isConnected, isDelayed } = useActionPolling({ patientId });
  const [whepConnected, setWhepConnected] = useState(false);
  const isNotFound    = error instanceof NotFoundError;
  const isAccessDenied = error instanceof ForbiddenError;


  const { data: patientAlerts } = useAlerts({ patientId });
  const { data: patientEvents, isLoading: isEventsLoading } = usePatientEvents(patientId);
  const readIds = useReadStore((s) => s.readIds);
  const { data: patients }       = usePatientList();
  const analysisItems            = useMemo(() => (patientEvents ?? []).map(eventToAnalysis), [patientEvents]);
  const chartData                = useMemo(() => buildChartData(analysisItems), [analysisItems]);
  const heatmapData              = useMemo(() => buildHeatmapData(analysisItems), [analysisItems]);
  // 최근 이벤트 목록 — 차트와 동일 데이터(위험점수 포함)로 최신순 정렬
  const recentEventsSorted       = useMemo(
    () => [...(patientEvents ?? [])].sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime()),
    [patientEvents],
  );

  // 영상 클립 — 최근 이벤트 매칭 + 공유 플레이어
  const { data: clips, refetch: refetchClips } = useClips({ patientId });
  const [playerClipId, setPlayerClipId] = useState<number | null>(null);
  const playerClip = clips?.find(c => c.id === playerClipId) ?? null;
  // 재생 직전 목록을 새로 받아 만료되지 않은 presigned URL 사용
  const openClip = (id: number) => { refetchClips(); setPlayerClipId(id); };

  // 이전 / 다음 어르신
  const currentIndex = patients?.findIndex(p => p.patient_id === patientId) ?? -1;
  const prevPatient  = currentIndex > 0 ? patients![currentIndex - 1] : null;
  const nextPatient  = currentIndex >= 0 && currentIndex < (patients?.length ?? 0) - 1
    ? patients![currentIndex + 1]
    : null;

  // 최신 위험점수 — 사건(incidents) 기준으로 계산 (2차 AI latest_risk/latest_risk_score 미사용)
  const latestRisk: RiskScore | null = riskFromRecentEvents(patientEvents ?? [], patientId);

  // 히어로 변수
  const riskLevel     = latestRisk?.risk_level;
  const heroGradient  = riskLevel === 'high'
    ? 'from-red-900 via-red-800 to-rose-900'
    : riskLevel === 'medium'
    ? 'from-amber-800 via-amber-700 to-orange-800'
    : 'from-blue-900 via-blue-800 to-indigo-900';

  // 카메라 상태 (위험점수 최신 업데이트 시각 기준)
  const riskScoreTs   = latestRisk?.created_at_utc ?? null;
  const riskAge       = riskScoreTs ? Date.now() - new Date(riskScoreTs).getTime() : null;
  const cameraOnline  = whepConnected || (riskAge !== null && riskAge < 60 * 60 * 1000);
  const cameraUnstable = !cameraOnline && riskAge !== null && riskAge < 6 * 60 * 60 * 1000;
  const cameraLabel   = cameraOnline ? '연결됨' : cameraUnstable ? '불안정' : '오프라인';
  const cameraColor   = cameraOnline ? 'text-emerald-300' : cameraUnstable ? 'text-amber-300' : 'text-slate-400';
  const cameraDot     = cameraOnline ? 'bg-emerald-400 animate-pulse' : cameraUnstable ? 'bg-amber-400' : 'bg-slate-400';

  // 마지막 감지 — 이벤트 우선, 없으면 대시보드 최근 이벤트/알림 기준
  const lastEventTs = useMemo(() => {
    const all = [
      ...(patientEvents ?? []),
      ...(dashboard?.recent_events ?? []),
    ];
    if (all.length === 0) return null;
    return [...all].sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())[0].ts_utc;
  }, [patientEvents, dashboard?.recent_events]);
  const lastAlertTs = patientAlerts && patientAlerts.length > 0
    ? [...patientAlerts].sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())[0].ts_utc
    : null;
  const lastActivityTs = lastEventTs ?? lastAlertTs;

  const hourlyData = useMemo(
    () => buildHourlyData(analysisItems),
    [analysisItems],
  );
  const currentHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  const patientName   = dashboard?.patient.name ?? patientId;

  return (
    <div>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${heroGradient} text-white transition-colors duration-700`}>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 size-48 rounded-full bg-white/5" />

        <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-8">

          {/* 상단: 뒤로가기 + PDF + 이전/다음 */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="no-print flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="size-4" />
                뒤로가기
              </button>
              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 transition-colors"
                title="PDF로 저장 / 인쇄"
              >
                <Printer className="size-4" />
                PDF 리포트
              </button>
            </div>

            <div className="flex items-center gap-2 no-print">
              <button
                onClick={() => prevPatient && navigate(`/dashboard/${prevPatient.patient_id}`)}
                disabled={!prevPatient}
                className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
                {prevPatient ? prevPatient.name : '이전'}
              </button>
              <button
                onClick={() => nextPatient && navigate(`/dashboard/${nextPatient.patient_id}`)}
                disabled={!nextPatient}
                className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {nextPatient ? nextPatient.name : '다음'}
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* 아바타 + 이름 */}
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            {isLoading ? (
              <Skeleton className="size-20 rounded-2xl bg-white/20" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
                <ElderAvatar size={52} />
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-40 bg-white/20 mx-auto" />
                <Skeleton className="h-4 w-24 bg-white/20 mx-auto" />
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-extrabold leading-tight">
                  {patientName}
                </h1>
                {!isGuardian && <p className="mt-1 text-sm text-white/55">{patientId}</p>}
              </div>
            )}

            {riskLevel && (
              <Badge
                variant="outline"
                className={`border-white/30 bg-white/10 text-white ${riskLevel === 'high' ? 'animate-pulse' : ''}`}
              >
위험도 · {riskLevelLabel[riskLevel]}
              </Badge>
            )}
          </div>

          {/* 3대 지표 */}
          {isLoading ? (
            <div className="flex gap-3 flex-wrap justify-center mt-2">
              <div className="flex divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm overflow-hidden">
                {[0, 1, 2].map(i => (
                  <div key={i} className="px-7 py-3 text-center space-y-1.5">
                    <Skeleton className="h-6 w-12 bg-white/20 mx-auto" />
                    <Skeleton className="h-3 w-12 bg-white/20 mx-auto" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-12 w-32 bg-white/20 rounded-2xl" />
              <Skeleton className="h-12 w-28 bg-white/20 rounded-2xl" />
            </div>
          ) : (
            <div className="flex justify-center gap-3 flex-wrap">
              <div className="flex divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm overflow-hidden">
                {/* 카메라 */}
                <div className="px-7 py-3 text-center">
                  <div className={`flex items-center justify-center gap-1.5 text-sm font-bold ${cameraColor}`}>
                    <span className={`size-2 rounded-full shrink-0 ${cameraDot}`} />
                    {cameraLabel}
                  </div>
                  <p className="text-xs text-white/55 mt-0.5">카메라</p>
                </div>
                {/* 마지막 감지 */}
                <div className="px-7 py-3 text-center">
                  <p className="text-sm font-bold">
                    {lastActivityTs ? relativeTime(lastActivityTs) : '이상 없음'}
                  </p>
                  <p className="text-xs text-white/55 mt-0.5">마지막 감지</p>
                </div>
              </div>

              {/* 알림 바로보기 버튼 */}
              <button
                onClick={() => navigate(`/alerts?patient_id=${patientId}`)}
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-5 py-3 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                <Bell className="size-4" />
                알림 보기
                {(() => {
                  const unread = patientAlerts?.filter(a => !a.is_read && !readIds.includes(a.id)).length ?? 0;
                  return unread > 0 ? (
                    <span className="rounded-full bg-red-400/80 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      {unread}
                    </span>
                  ) : null;
                })()}
              </button>

              {/* 긴급 연락 버튼 */}
              {!isGuardian && (
                <button
                  type="button"
                  onClick={() => toast.success('보호자에게 긴급 연락 요청을 전송했습니다', { duration: 4000 })}
                  className="flex items-center gap-2 rounded-2xl border border-red-400/50 bg-red-500/20 backdrop-blur-sm px-5 py-3 text-sm font-medium text-red-200 hover:bg-red-500/35 transition-colors"
                >
                  <Phone className="size-4" />
                  긴급 연락
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 에러 상태 ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-4 space-y-2">
        {isNotFound && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            어르신 정보를 찾을 수 없습니다.
          </div>
        )}
        {isAccessDenied && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
            이 어르신에 대한 접근 권한이 없습니다.
          </div>
        )}
      </div>

      {/* ── 본문 ─────────────────────────────────────────────────── */}
      {!isNotFound && !isAccessDenied && (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-12 gap-6">

            {/* 어르신 정보 */}
            <Card className="col-span-12 overflow-hidden">
              {dashboard && (
                <div className={`h-1 w-full ${riskLevel
                  ? { high: 'bg-gradient-to-r from-red-400 to-red-500', medium: 'bg-gradient-to-r from-yellow-400 to-amber-400', low: 'bg-gradient-to-r from-green-400 to-emerald-400' }[riskLevel]
                  : 'bg-slate-200'}`}
                />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">어르신 정보</CardTitle>
                  {!isGuardian && dashboard?.patient.status === 'active' && (
                    <span className="flex items-center gap-1.5 text-xs text-green-600">
                      <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                      보호자 모니터링 사용중
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : dashboard ? (
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    {[
                      { icon: User,     iconClass: 'bg-blue-100',   iconColor: 'text-blue-600',   label: '이름', value: dashboard.patient.name },
                      { icon: Users,    iconClass: 'bg-purple-100', iconColor: 'text-purple-600', label: '성별', value: dashboard.patient.gender ?? '미등록' },
                      { icon: Calendar, iconClass: 'bg-orange-100', iconColor: 'text-orange-600', label: '나이', value: dashboard.patient.birth_date ? `${formatAge(dashboard.patient.birth_date)}세` : '미등록' },
                      {
                        icon: Heart,
                        iconClass: dashboard.patient.status === 'active' ? 'bg-green-100' : 'bg-slate-100',
                        iconColor: dashboard.patient.status === 'active' ? 'text-green-600' : 'text-slate-400',
                        label: '상태',
                        value: dashboard.patient.status === 'active' ? '활성' : dashboard.patient.status,
                        valueClass: dashboard.patient.status === 'active' ? 'text-green-700' : 'text-slate-600',
                      },
                    ].map(({ icon: Icon, iconClass, iconColor, label, value, valueClass }) => (
                      <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-start gap-3 hover:bg-white hover:shadow-sm transition-all duration-200 cursor-default">
                        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
                          <Icon className={`size-4 ${iconColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className={`mt-0.5 font-semibold ${valueClass ?? 'text-slate-800'}`}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* 실시간 영상 */}
            <Card className="col-span-8 overflow-hidden">
              <div className="h-0.5 w-full bg-blue-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-semibold shrink-0">실시간 영상</CardTitle>
                  {!isLoading && (
                    <div className="w-1/3">
                      <ActionOverlayPanel
                        event={latestEvent}
                        isConnected={isConnected}
                        isDelayed={isDelayed}
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="aspect-video w-full rounded-md" />
                ) : (
                  <VideoPlayer
                    streamPath={patientId}
                    onStatusChange={setWhepConnected}
                  />
                )}
              </CardContent>
            </Card>

            {/* 위험점수 + 최근 이벤트 */}
            <div className="col-span-4 space-y-4">
              <Card className={`overflow-hidden ${riskLevel ? riskCardClass[riskLevel] : ''}`}>
                <div className={`h-0.5 w-full ${riskLevel
                  ? { high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-green-400' }[riskLevel]
                  : 'bg-slate-200'}`}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">최신 위험점수</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : latestRisk ? (
                    <div className="space-y-3">
                      <RiskGauge score={latestRisk.score} level={latestRisk.risk_level} />
                      <RiskSegmentBar score={latestRisk.score} />
                      <div className="flex justify-center">
                        <Badge variant="outline" className={riskBadgeClass[latestRisk.risk_level]}>
                          {riskLevelLabel[latestRisk.risk_level]}
                        </Badge>
                      </div>
                      {latestRisk.reason && (
                        <p className="text-sm text-slate-600 text-center">{latestRisk.reason}</p>
                      )}
                      <p className="text-xs text-slate-400 text-center">{formatKST(latestRisk.created_at_utc)}</p>
                    </div>
                  ) : (
                    <EmptyState message="위험점수 없음" sub="분석 데이터를 기다리는 중입니다" />
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <div className="h-0.5 w-full bg-slate-200" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">최근 이벤트</CardTitle>
                    {recentEventsSorted.length > 0 && (
                      <span className="text-xs text-slate-400">{recentEventsSorted.length}건</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                    </div>
                  ) : recentEventsSorted.length > 0 ? (
                    <ul className="space-y-1.5 max-h-[260px] overflow-y-auto overflow-x-hidden pr-1">
                      {recentEventsSorted.map((event, i) => {
                        const EventIcon = getEventIcon(event.event_type);
                        const sevCat = eventLevelCategory(event);
                        const severityColor =
                          sevCat === 'danger' ? 'bg-red-500' :
                          sevCat === 'warning' ? 'bg-yellow-400' : 'bg-green-400';
                        const clip = findClipForEvent(event, clips);
                        return (
                          <li
                            key={event.id}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 animate-in fade-in slide-in-from-right-2 duration-300 ${severityBorderClass(sevCat)}`}
                            style={{ animationDelay: `${i * 80}ms` }}
                          >
                            <span className={`size-1.5 rounded-full shrink-0 ${severityColor}`} />
                            <EventIcon className="size-3.5 shrink-0 text-slate-400" />
                            <span className="flex-1 truncate text-xs font-medium text-slate-700">{translateEventType(event.event_type)}</span>
                            {clip && (
                              <button
                                type="button"
                                onClick={() => openClip(clip.id)}
                                className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-100"
                              >
                                <Play className="size-3" />
                                영상
                              </button>
                            )}
                            <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap">{formatKST(event.ts_utc)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyState message="최근 이벤트 없음" sub="감지된 이상 활동이 없습니다" />
                  )}
                </CardContent>
              </Card>

            </div>

            {/* 알림 분석 차트 */}
            <Card className="col-span-12">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>알림 분석</CardTitle>
                    {analysisItems.length > 0 && (
                      <span className="text-xs text-slate-400">{analysisItems.length}건</span>
                    )}
                  </div>
                  <div className="flex rounded-lg bg-slate-100 p-1 gap-0.5">
                    {([
                      { key: 'trend',    label: '7일 추이' },
                      { key: 'activity', label: '활동 시간표' },
                      { key: 'heatmap',  label: '활동 히트맵' },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setChartTab(tab.key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                          chartTab === tab.key
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isEventsLoading ? (
                  <div className="space-y-3 py-1">
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-7 w-20 rounded-md" />
                      <Skeleton className="h-7 w-20 rounded-md" />
                    </div>
                    <Skeleton className="h-[220px] w-full rounded-lg" />
                  </div>
                ) : chartTab === 'trend' ? (
                  <ResponsiveContainer width="100%" height={220} debounce={1}>
                    <BarChart data={chartData} barSize={32} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar dataKey="safe"    name="안전" stackId="a" fill="#86efac" />
                      <Bar dataKey="warning" name="주의" stackId="a" fill="#fde047" />
                      <Bar dataKey="danger"  name="위험" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : chartTab === 'heatmap' ? (
                  <div className="space-y-4 py-1">
                    <p className="text-xs text-slate-400">최근 7일 시간대별 알림 발생 현황 (KST 기준)</p>
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: '68px repeat(7, 1fr)' }}
                    >
                      {/* 헤더 행 */}
                      <div />
                      {heatmapData.dayWeekLabels.map((label, i) => (
                        <div key={i} className="text-center">
                          <p className="text-[11px] font-semibold text-slate-600">{label}</p>
                          <p className="text-[9px] text-slate-400">{heatmapData.dayDateLabels[i]}</p>
                        </div>
                      ))}
                      {/* 시간대별 행 */}
                      {HEATMAP_BLOCK_LABELS.map((blockLabel, blockIdx) => (
                        <Fragment key={blockIdx}>
                          <div className="flex items-center justify-end pr-1 text-[10px] text-slate-400 leading-tight">
                            {blockLabel}
                          </div>
                          {heatmapData.grid[blockIdx].map((cell, dayIdx) => {
                            const typeStr = Object.entries(cell.typeCounts)
                              .map(([t, n]) => n > 1 ? `${t} ${n}건` : t)
                              .join(', ');
                            const titleStr = cell.count > 0
                              ? `${heatmapData.dayDateLabels[dayIdx]} ${blockLabel}: ${cell.count}건\n${typeStr}`
                              : '';
                            return (
                              <div
                                key={dayIdx}
                                className={`h-9 rounded-md flex items-center justify-center text-[11px] font-semibold cursor-default transition-colors ${heatCellClass(cell.count)}`}
                                title={titleStr}
                              >
                                {cell.count > 0 ? cell.count : ''}
                              </div>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                    {/* 범례 */}
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <span className="text-[10px] text-slate-400">낮음</span>
                      <div className="flex gap-1">
                        {['bg-slate-100', 'bg-amber-100', 'bg-amber-300', 'bg-orange-400', 'bg-red-500'].map((c, i) => (
                          <div key={i} className={`w-5 h-3 rounded-sm ${c}`} />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400">높음</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-3">
                    <p className="text-xs text-slate-400 mb-3">오늘 시간대별 활동 현황 (KST 기준)</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {hourlyData.map(({ hour, items }) => {
                        const isCurrent = hour === currentHour;
                        const isFuture  = hour > currentHour;
                        const catDotCls = (cat: SeverityCategory) =>
                          cat === 'danger'  ? 'bg-red-500 animate-pulse' :
                          cat === 'warning' ? 'bg-amber-400' : 'bg-emerald-400';
                        return (
                          <div
                            key={hour}
                            className={`rounded-xl px-2.5 py-2 flex flex-col gap-1 transition-colors ${
                              isCurrent ? 'bg-blue-50 border border-blue-200' :
                              isFuture  ? 'opacity-30' :
                              items.length > 0 ? 'bg-amber-50/60 border border-amber-100' : 'bg-slate-50'
                            }`}
                          >
                            <span className={`text-[10px] font-mono font-bold ${
                              isCurrent ? 'text-blue-600' : 'text-slate-400'
                            }`}>
                              {String(hour).padStart(2, '0')}:00
                            </span>
                            <div className="flex flex-wrap gap-1 min-h-[16px]">
                              {items.length === 0 ? (
                                <span className={`size-2.5 rounded-full ${isCurrent ? 'bg-blue-200' : 'bg-slate-200'}`} />
                              ) : (
                                items.map((item, i) => (
                                  <div key={i} title={translateEventType(item.type)} className="flex items-center">
                                    <span className={`size-2.5 rounded-full ${catDotCls(item.cat)}`} />
                                  </div>
                                ))
                              )}
                            </div>
                            {items.length > 0 && (
                              <p className="text-[9px] text-slate-500 leading-snug truncate">
                                {[...new Set(items.map(i => translateEventType(i.type)))].join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-3 justify-end">
                      {[
                        { cls: 'bg-red-500', label: '위험' },
                        { cls: 'bg-amber-400', label: '주의' },
                        { cls: 'bg-emerald-400', label: '안전' },
                        { cls: 'bg-slate-200', label: '없음' },
                      ].map(({ cls, label }) => (
                        <span key={label} className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className={`size-2 rounded-full ${cls}`} />{label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 영상 클립 */}
            <ClipsCard patientId={patientId} onSelect={openClip} />

          </div>
        </div>
      )}

      {/* ── PRINT-ONLY REPORT ──────────────────────────────────────────── */}
      <div className="hidden print:block p-8 text-slate-900">

        {/* 리포트 헤더 */}
        <div className="border-b-2 border-slate-800 pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">안전 돌봄 서비스</h1>
            <p className="text-sm text-slate-500 mt-0.5">독거노인 안전 모니터링 — 어르신 활동 리포트</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>생성일시: {new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
            <p>어르신 ID: {patientId}</p>
          </div>
        </div>

        {/* 기본 정보 */}
        {dashboard?.patient && (
          <section className="mb-6">
            <h2 className="text-base font-bold border-b border-slate-200 pb-1 mb-3">어르신 기본 정보</h2>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 text-slate-500 w-24">이름</td>
                  <td className="py-1.5 font-medium">{dashboard.patient.name}</td>
                  <td className="py-1.5 pr-4 text-slate-500 w-24">어르신 ID</td>
                  <td className="py-1.5 font-medium">{patientId}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 text-slate-500">성별</td>
                  <td className="py-1.5 font-medium">{dashboard.patient.gender ?? '미등록'}</td>
                  <td className="py-1.5 pr-4 text-slate-500">나이</td>
                  <td className="py-1.5 font-medium">{dashboard.patient.birth_date ? `${formatAge(dashboard.patient.birth_date)}세` : '미등록'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-500">상태</td>
                  <td className="py-1.5 font-medium">{dashboard.patient.status === 'active' ? '활성' : dashboard.patient.status}</td>
                  <td className="py-1.5 pr-4 text-slate-500">카메라</td>
                  <td className="py-1.5 font-medium">{cameraLabel}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* 위험점수 */}
        {latestRisk && (
          <section className="mb-6">
            <h2 className="text-base font-bold border-b border-slate-200 pb-1 mb-3">최신 위험점수</h2>
            <div className="flex items-center gap-6">
              <div className="text-4xl font-extrabold tabular-nums">
                {latestRisk.score.toFixed(1)}
                <span className="text-lg font-normal text-slate-400 ml-1">/ 5</span>
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {latestRisk.risk_level === 'high' ? '위험 수준'
                    : latestRisk.risk_level === 'medium' ? '주의 수준'
                    : '안전 수준'}
                </p>
                {latestRisk.reason && (
                  <p className="text-sm text-slate-600 mt-0.5">{latestRisk.reason}</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{formatKST(latestRisk.created_at_utc)}</p>
              </div>
            </div>
          </section>
        )}

        {/* 알림 통계 */}
        {patientAlerts && patientAlerts.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-bold border-b border-slate-200 pb-1 mb-3">알림 통계</h2>
            <div className="flex gap-4">
              {([
                { label: '전체', value: patientAlerts.length },
                { label: '위험', value: patientAlerts.filter(a => a.level === 'critical').length },
                { label: '높음', value: patientAlerts.filter(a => a.level === 'high').length },
                { label: '중간', value: patientAlerts.filter(a => a.level === 'medium').length },
                { label: '낮음', value: patientAlerts.filter(a => a.level === 'low').length },
              ] as const).map(({ label, value }) => (
                <div key={label} className="border border-slate-200 rounded p-3 text-center min-w-[64px]">
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 알림 내역 테이블 */}
        {patientAlerts && patientAlerts.length > 0 && (
          <section>
            <h2 className="text-base font-bold border-b border-slate-200 pb-1 mb-3">최근 알림 내역 (최대 30건)</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border border-slate-200">
                  <th className="text-left py-2 px-2 font-semibold text-slate-600 w-40">일시 (KST)</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">유형</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600 w-16">수준</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">내용</th>
                </tr>
              </thead>
              <tbody>
                {[...patientAlerts]
                  .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
                  .slice(0, 30)
                  .map(alert => (
                    <tr key={alert.id} className="border-b border-slate-100">
                      <td className="py-1.5 px-2 text-slate-600 tabular-nums">{formatKST(alert.ts_utc)}</td>
                      <td className="py-1.5 px-2 font-medium">{translateEventType(alert.alert_type)}</td>
                      <td className="py-1.5 px-2">
                        {alert.level === 'critical' ? '위험'
                          : alert.level === 'high' ? '높음'
                          : alert.level === 'medium' ? '중간' : '낮음'}
                      </td>
                      <td className="py-1.5 px-2 text-slate-500">{alert.message ?? '–'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-4 text-right">
              본 리포트는 안전 돌봄 서비스 시스템에서 자동 생성되었습니다.
            </p>
          </section>
        )}
      </div>

      {/* 공유 영상 클립 플레이어 (클립 목록 + 최근 이벤트 영상 버튼 공용) */}
      <ClipPlayerModal clip={playerClip} onClose={() => setPlayerClipId(null)} />
    </div>
  );
}
