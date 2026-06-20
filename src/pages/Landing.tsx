import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck, Video, Activity, Bell } from 'lucide-react';
import { useIsAuthenticated } from '@/lib/auth-store';

const FEATURES = [
  { icon: Video, label: '실시간 영상 감시' },
  { icon: Activity, label: '낙상·이상행동 감지' },
  { icon: Bell, label: '즉시 알림' },
] as const;

export default function Landing() {
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    document.title = '독거노인 안전 모니터링';
  }, []);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* 배경 글로우 블롭 */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-700/15 blur-[120px]" />
        <div className="absolute left-1/4 top-2/3 h-[250px] w-[350px] rounded-full bg-indigo-600/10 blur-[80px]" />
      </div>

      {/* 격자 패턴 오버레이 */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* 헤더 — 로고만 */}
      <header className="relative z-10 flex items-center px-8 py-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-blue-400" />
          <span className="text-sm font-semibold tracking-wide text-slate-200">
            독거노인 안전 모니터링
          </span>
        </div>
      </header>

      {/* 히어로 */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        {/* 아이콘 뱃지 */}
        <div className="mb-8 flex size-[72px] items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/15 shadow-[0_0_40px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/20">
          <ShieldCheck className="size-9 text-blue-400" />
        </div>

        {/* 헤드라인 */}
        <h1 className="mb-4 text-5xl font-bold tracking-tight leading-tight">
          혼자 계신 어르신을
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            AI가 24시간 지킵니다
          </span>
        </h1>

        {/* 서브 문구 */}
        <p className="mb-10 max-w-sm text-base text-slate-400 leading-relaxed">
          실시간 영상 분석으로 낙상·이상행동을 감지하고
          <br />
          보호자에게 즉시 알림을 전송합니다
        </p>

        {/* 기능 뱃지 */}
        <div className="mb-12 flex flex-wrap justify-center gap-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm"
            >
              <Icon className="size-4 text-blue-400" />
              {label}
            </span>
          ))}
        </div>

        {/* CTA 버튼 그룹 */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.45)] transition-all hover:bg-blue-500 hover:shadow-[0_0_36px_rgba(59,130,246,0.6)]"
          >
            로그인하기
            <span className="text-blue-200">→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
