import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, ShieldCheck, LogOut, Wifi, WifiOff, ChevronRight, X, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { useReadStore } from '@/lib/read-store';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useAlerts } from '@/hooks/useAlerts';
import { usePatientList } from '@/hooks/usePatientList';
import OnboardingTour from '@/components/OnboardingTour';
import type { AlertLevel } from '@/types/api';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: '안전 모니터링', tourId: 'nav-dashboard' },
  { to: '/alerts', icon: Bell, label: '알림', tourId: 'nav-alerts' },
] as const;

const statusDotClass: Record<AlertLevel, string> = {
  critical: 'bg-red-500 animate-pulse',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-400',
};

const feedLevelColor: Record<AlertLevel, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-400',
};

const feedLevelLabel: Record<AlertLevel, string> = {
  critical: '위험',
  high: '높음',
  medium: '중간',
  low: '낮음',
};

// ── helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}초 전`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}분 전`;
  return `${Math.floor(mins / 60)}시간 전`;
}

// ── sub-components ─────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = now.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = now.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  return (
    <div className="text-right">
      <p className="text-xs font-semibold text-slate-700 tabular-nums">{timeStr}</p>
      <p className="text-[10px] text-slate-400">{dateStr}</p>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthUser();
  const serverOnline = useServerStatus();
  const { data: allAlerts } = useAlerts();
  const { data: patients } = usePatientList();

  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  const markRead = useReadStore((s) => s.markRead);
  const readIds = useReadStore((s) => s.readIds);
  const unreadCount = allAlerts?.filter(a => !a.is_read && !readIds.includes(a.id)).length ?? 0;

  // 알림 패널이 열리면 전체 읽음 처리
  useEffect(() => {
    if (!notifPanelOpen || !allAlerts) return;
    const unreadIds = allAlerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length > 0) markRead(unreadIds);
  }, [notifPanelOpen, allAlerts, markRead]);

  const patientMap = useMemo(() => {
    if (!patients) return {} as Record<string, string>;
    return Object.fromEntries(patients.map(p => [p.patient_id, p.name]));
  }, [patients]);

  const lastDataTs = allAlerts && allAlerts.length > 0
    ? allAlerts.reduce((a, b) => new Date(a.ts_utc) > new Date(b.ts_utc) ? a : b).ts_utc
    : null;

  // 오늘의 요약
  const todayStats = useMemo(() => {
    if (!allAlerts) return null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = allAlerts.filter(a => new Date(a.ts_utc) >= todayStart);
    return {
      total: today.length,
      critical: today.filter(a => a.level === 'critical' || a.level === 'high').length,
    };
  }, [allAlerts]);

  // 환자 빠른 상태
  const patientStats = useMemo(() => {
    if (!patients || !allAlerts) return null;
    const levels: AlertLevel[] = ['critical', 'high', 'medium', 'low'];
    return patients.map(p => {
      const pa = allAlerts.filter(a => a.patient_id === p.patient_id);
      const alertHighestLevel = levels.find(l => pa.some(a => a.level === l)) ?? null;
      const highestLevel = (p.latest_risk_score?.risk_level as AlertLevel | undefined) ?? alertHighestLevel;
      return { id: p.patient_id, name: p.name, highestLevel };
    });
  }, [patients, allAlerts]);

  // 최근 알림 피드 (최신 3건)
  const recentAlerts = useMemo(() => {
    if (!allAlerts) return [];
    return [...allAlerts]
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
      .slice(0, 3);
  }, [allAlerts]);

  // 마지막 수신 시간 갱신용 tick
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <OnboardingTour />

      {/* 사이드바 */}
      <aside className="w-60 shrink-0 border-r border-white/10 bg-gradient-to-b from-blue-900 to-indigo-950 flex flex-col">

        {/* 브랜드 헤더 */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/10 shrink-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white leading-snug">
            독거노인<br />안전 모니터링
          </span>
        </div>

        {/* 네비게이션 */}
        <nav className="p-3 space-y-1 shrink-0">
          {NAV_ITEMS.map(({ to, icon: Icon, label, tourId }) => (
            <NavLink
              key={to}
              to={to}
              data-tour={tourId}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {to === '/alerts' && unreadCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 스크롤 가능한 중간 영역 */}
        <div className="flex-1 overflow-y-auto space-y-4 px-3 py-2">

          {/* A. 오늘의 요약 */}
          <div>
            <p className="text-[10px] font-semibold text-blue-300/60 uppercase tracking-wider px-1 mb-2">오늘의 현황</p>
            {todayStats ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/10 border border-white/10 p-2.5 text-center">
                  <p className="text-lg font-bold text-white">{todayStats.total}</p>
                  <p className="text-[10px] text-blue-200/60 mt-0.5">전체 알림</p>
                </div>
                <div className={`rounded-lg border p-2.5 text-center ${todayStats.critical > 0 ? 'bg-red-500/20 border-red-500/30' : 'bg-white/10 border-white/10'}`}>
                  <p className={`text-lg font-bold ${todayStats.critical > 0 ? 'text-red-300' : 'text-white'}`}>{todayStats.critical}</p>
                  <p className="text-[10px] text-blue-200/60 mt-0.5">위험 알림</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map(i => <div key={i} className="rounded-lg bg-white/10 animate-pulse h-14" />)}
              </div>
            )}
          </div>

          {/* B. 사용자 빠른 상태 */}
          <div>
            <p className="text-[10px] font-semibold text-blue-300/60 uppercase tracking-wider px-1 mb-2">사용자 상태</p>
            <div className="space-y-1">
              {patientStats ? patientStats.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/dashboard/${p.id}`)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 transition-colors group ${p.highestLevel === 'critical' ? 'border-l-2 border-red-400' : p.highestLevel === 'high' ? 'border-l-2 border-orange-400' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className="size-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-blue-200 group-hover:bg-white/20 group-hover:text-white transition-colors">
                      {p.name.charAt(0)}
                    </div>
                    {p.highestLevel && (
                      <span className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-indigo-950 ${statusDotClass[p.highestLevel]}`} />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-blue-300/60 truncate">{p.id}</p>
                    {p.highestLevel ? (
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                        p.highestLevel === 'critical' ? 'bg-red-500/30 text-red-300' :
                        p.highestLevel === 'high' ? 'bg-orange-500/30 text-orange-300' :
                        p.highestLevel === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-green-500/30 text-green-300'
                      }`}>
                        {feedLevelLabel[p.highestLevel]}
                      </span>
                    ) : (
                      <span className="text-[10px] text-blue-300/60 mt-0.5 block">이상 없음</span>
                    )}
                  </div>
                  <ChevronRight className="size-3.5 text-blue-400/40 group-hover:text-white shrink-0 transition-colors" />
                </button>
              )) : (
                <div className="space-y-1">
                  {[0, 1].map(i => <div key={i} className="rounded-lg bg-white/10 animate-pulse h-10" />)}
                </div>
              )}
            </div>
          </div>

          {/* C. 최근 알림 피드 */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[10px] font-semibold text-blue-300/60 uppercase tracking-wider">최근 알림</p>
              <button
                onClick={() => navigate('/alerts')}
                className="text-[10px] text-blue-400/60 hover:text-blue-200 transition-colors"
              >
                전체보기
              </button>
            </div>
            {recentAlerts.length > 0 ? (
              <div className="space-y-1">
                {recentAlerts.map(alert => (
                  <button
                    key={alert.id}
                    onClick={() => navigate('/alerts')}
                    className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-left group"
                  >
                    <span className={`mt-1 size-2 rounded-full shrink-0 ${feedLevelColor[alert.level]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-white truncate group-hover:text-blue-100">{alert.alert_type}</p>
                      <p className="text-[10px] text-blue-300/60">{alert.patient_id} · {relativeTime(alert.ts_utc)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-blue-300/60 px-2">최근 알림 없음</p>
            )}
          </div>

        </div>

        {/* 하단 사용자 정보 */}
        {user && (
          <div className="p-3 border-t border-white/10 space-y-1 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                {user.email[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-blue-100 truncate">{user.email}</p>
                <Badge variant="secondary" className="mt-0.5 h-4 px-1 text-[10px] capitalize bg-white/10 text-blue-200 border-white/10 hover:bg-white/10">
                  {user.role}
                </Badge>
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              data-tour="profile-btn"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <User className="size-4 shrink-0" />
              내 프로필
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-200 transition-colors hover:bg-red-500/20 hover:text-red-300"
            >
              <LogOut className="size-4 shrink-0" />
              로그아웃
            </button>
          </div>
        )}
      </aside>

      {/* 메인 영역 */}
      <main className="flex flex-1 flex-col min-w-0">
        <header className="h-14 shrink-0 border-b bg-gradient-to-r from-white to-slate-50/80 flex items-center justify-between px-6">
          {/* 좌측: 서버 상태 + 마지막 수신 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              {serverOnline === null ? (
                <span className="text-slate-400">연결 확인 중...</span>
              ) : serverOnline ? (
                <>
                  <Wifi className="size-3.5 text-green-500" />
                  <span className="text-green-600 font-medium">서버 연결됨</span>
                </>
              ) : (
                <>
                  <WifiOff className="size-3.5 text-red-400" />
                  <span className="text-red-500 font-medium">서버 연결 끊김</span>
                </>
              )}
            </div>
            {lastDataTs && (
              <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-3">
                마지막 수신 {relativeTime(lastDataTs)}
              </span>
            )}
          </div>

          {/* 우측: 알림 벨 + 실시간 시계 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-tour="alert-bell"
              onClick={() => setNotifPanelOpen(true)}
              className="relative flex items-center justify-center size-8 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="알림 패널 열기"
            >
              <Bell className="size-4 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <LiveClock />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <div key={location.pathname} className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <Outlet />
          </div>
        </div>
      </main>

      {/* ── 알림 슬라이드 패널 ────────────────────────────────── */}
      {notifPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
            onClick={() => setNotifPanelOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full z-50 w-96 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out">

            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-slate-600" />
                <h2 className="text-sm font-semibold text-slate-800">알림</h2>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setNotifPanelOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 알림 목록 */}
            <div className="flex-1 overflow-y-auto">
              {allAlerts && allAlerts.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {[...allAlerts]
                    .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
                    .slice(0, 40)
                    .map(alert => {
                      const name = patientMap[alert.patient_id] ?? alert.patient_id;
                      return (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => { markRead([alert.id]); navigate(`/dashboard/${alert.patient_id}`); setNotifPanelOpen(false); }}
                          className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors ${!alert.is_read && !readIds.includes(alert.id) ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1.5 size-2 rounded-full shrink-0 ${feedLevelColor[alert.level]}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-800">{name} 어르신</span>
                                {!alert.is_read && !readIds.includes(alert.id) && (
                                  <span className="text-[9px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none">NEW</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">{alert.alert_type}</p>
                              {alert.message && (
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{alert.message}</p>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                alert.level === 'critical' ? 'bg-red-100 text-red-600' :
                                alert.level === 'high'     ? 'bg-orange-100 text-orange-600' :
                                alert.level === 'medium'   ? 'bg-yellow-100 text-yellow-600' :
                                                             'bg-green-100 text-green-600'
                              }`}>
                                {feedLevelLabel[alert.level]}
                              </span>
                              <span className="text-[10px] text-slate-400">{relativeTime(alert.ts_utc)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                  <Bell className="size-10 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">알림 없음</p>
                  <p className="text-xs text-slate-300">아직 발생한 알림이 없습니다</p>
                </div>
              )}
            </div>

            {/* 전체 알림 이동 버튼 */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => { navigate('/alerts'); setNotifPanelOpen(false); }}
                className="w-full rounded-xl bg-slate-800 text-white text-sm font-medium py-2.5 hover:bg-slate-700 transition-colors"
              >
                전체 알림 보기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
