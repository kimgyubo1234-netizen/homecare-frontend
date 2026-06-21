import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Bell, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { useAllEvents } from '@/hooks/useAllEvents';
import { useSeenStore } from '@/lib/seen-store';
import SseProvider from '@/components/SseProvider';
import OnboardingTour from '@/components/OnboardingTour';
import AlertPanel from '@/components/AlertPanel';

export default function HomeLayout() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthUser();
  const { data: allEvents } = useAllEvents(200);
  const [panelOpen, setPanelOpen] = useState(false);
  const seenAt = useSeenStore((s) => s.seenAt);
  const markSeen = useSeenStore((s) => s.markSeen);

  // 확인하지 않은(24시간 이내, seenAt 이후) 이벤트 수를 배지로 표시
  const unseenCount = useMemo(() => {
    if (!allEvents) return 0;
    const now = Date.now();
    const seen = seenAt ? new Date(seenAt).getTime() : 0;
    return allEvents.filter(e => {
      const t = new Date(e.ts_utc).getTime();
      return now - t < 24 * 60 * 60 * 1000 && t > seen;
    }).length;
  }, [allEvents, seenAt]);

  const openPanel = () => {
    markSeen();
    setPanelOpen(true);
  };

  useEffect(() => {
    document.title = unseenCount > 0
      ? `(${unseenCount}) 어르신 안전 돌봄 서비스`
      : '어르신 안전 돌봄 서비스';
  }, [unseenCount]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white">
      <SseProvider />
      <OnboardingTour />
      <AlertPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            data-tour="brand-logo"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            {/* 커스텀 로고 — 방패 + 하트 */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="10" fill="#1e3a8a"/>
              <path
                d="M16 5 L24 8.2 L24 16.5 C24 21.5 20.5 25 16 27 C11.5 25 8 21.5 8 16.5 L8 8.2 Z"
                fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"
              />
              <path
                d="M16 21 C16 21 11.2 17.4 11.2 14.6 C11.2 13.1 12.3 12 13.6 12 C14.4 12 15.1 12.4 16 13.2 C16.9 12.4 17.6 12 18.4 12 C19.7 12 20.8 13.1 20.8 14.6 C20.8 17.4 16 21 16 21Z"
                fill="rgba(252,165,165,0.92)"
              />
            </svg>
            <span className="text-sm font-bold text-slate-800 leading-tight">
              어르신 안전 돌봄 서비스
            </span>
          </button>

          <div className="flex items-center gap-6">
            {/* 알림 벨 버튼 */}
            <button
              type="button"
              data-tour="nav-alerts"
              onClick={openPanel}
              className="relative flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 font-medium transition-colors"
            >
              <Bell className="size-4" />
              알림
              {unseenCount > 0 && (
                <span className="absolute -top-2.5 -right-3.5 min-w-[18px] rounded-full bg-blue-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
            </button>

            {user && (
              <div data-tour="user-section" className="flex items-center gap-3 border-l border-slate-200 pl-6">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 group"
                  title="프로필 설정"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 group-hover:bg-blue-200 transition-colors">
                    {user.email[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-600 max-w-[160px] truncate group-hover:text-blue-700 transition-colors">{user.email}</span>
                </Link>
                {user.role === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <LayoutDashboard className="size-3.5" />
                    관리자 페이지
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  <LogOut className="size-3.5" />
                  로그아웃
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  );
}
