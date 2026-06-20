import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldCheck, Video, Bell, BarChart3, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, UnauthorizedError, NetworkError } from '@/lib/api';
import { useAuthStore, useIsAuthenticated } from '@/lib/auth-store';
import type { LoginResponse } from '@/types/api';

const schema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

type FormValues = z.infer<typeof schema>;

const features = [
  { Icon: Video,      text: '실시간 영상 모니터링' },
  { Icon: Bell,       text: '위험 감지 즉시 알림' },
  { Icon: BarChart3,  text: 'AI 위험도 자동 분석' },
];

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useIsAuthenticated();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    document.title = '어르신 안전 돌봄 서비스 — 로그인';
  }, []);

  const authUser = useAuthStore((s) => s.user);
  if (isAuthenticated) return <Navigate to={authUser?.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setLoginError(null);
    try {
      const res = await apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuth(res.access_token, { id: res.user_id, email: res.email, role: res.role });
      navigate(res.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err instanceof NetworkError) {
        setLoginError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setLoginError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── 왼쪽 브랜드 패널 (lg 이상) ── */}
      <div className="hidden lg:flex w-1/2 flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 relative overflow-hidden">
        {/* 배경 글로우 */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-blue-600/10 blur-[90px]" />
          <div className="absolute right-1/4 bottom-1/4 h-48 w-48 rounded-full bg-indigo-500/10 blur-[70px]" />
        </div>
        {/* 격자 패턴 */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex h-full flex-col px-12 py-10">
          {/* 로고 */}
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/20">
              <ShieldCheck className="size-5 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white/80">어르신 안전 돌봄 서비스</span>
          </div>

          {/* 중앙 콘텐츠 */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {/* SVG 일러스트 */}
            <svg
              width="220" height="220" viewBox="0 0 220 220" fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mb-10 drop-shadow-[0_0_30px_rgba(59,130,246,0.2)]"
            >
              {/* 펄스 링 */}
              <circle cx="110" cy="110" r="100" stroke="rgba(99,179,237,0.07)"  strokeWidth="1"/>
              <circle cx="110" cy="110" r="80"  stroke="rgba(99,179,237,0.10)"  strokeWidth="1"/>
              <circle cx="110" cy="110" r="60"  stroke="rgba(99,179,237,0.16)"  strokeWidth="1.5"/>
              <circle cx="110" cy="110" r="40"  fill="rgba(59,130,246,0.08)" stroke="rgba(147,197,253,0.25)" strokeWidth="1.5"/>

              {/* 집 */}
              <path d="M90 102 L90 128 L130 128 L130 102" fill="rgba(59,130,246,0.18)" stroke="rgba(147,197,253,0.65)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M100 128 L100 114 L120 114 L120 128" fill="rgba(59,130,246,0.32)" stroke="rgba(147,197,253,0.65)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M84 104 L110 80 L136 104" fill="none" stroke="rgba(147,197,253,0.88)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

              {/* 하트 */}
              <path
                d="M110 108 C110 106 108 104 106 105 C103 104 101 106.5 101 109 C101 112.5 106.5 116.5 110 119 C113.5 116.5 119 112.5 119 109 C119 106.5 117 104 114 105 C112 104 110 106 110 108Z"
                fill="rgba(252,165,165,0.85)"
              />

              {/* 외곽 점 */}
              <circle cx="110" cy="28"  r="3.5" fill="rgba(99,179,237,0.65)"/>
              <circle cx="174" cy="68"  r="3"   fill="rgba(99,179,237,0.55)"/>
              <circle cx="174" cy="152" r="3"   fill="rgba(99,179,237,0.55)"/>
              <circle cx="110" cy="192" r="3.5" fill="rgba(99,179,237,0.65)"/>
              <circle cx="46"  cy="152" r="3"   fill="rgba(99,179,237,0.55)"/>
              <circle cx="46"  cy="68"  r="3"   fill="rgba(99,179,237,0.55)"/>

              {/* 점선 연결 */}
              <line x1="110" y1="70"  x2="110" y2="33"  stroke="rgba(99,179,237,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
              <line x1="148" y1="88"  x2="171" y2="71"  stroke="rgba(99,179,237,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
              <line x1="148" y1="132" x2="171" y2="149" stroke="rgba(99,179,237,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
              <line x1="110" y1="150" x2="110" y2="187" stroke="rgba(99,179,237,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
              <line x1="72"  y1="132" x2="49"  y2="149" stroke="rgba(99,179,237,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
              <line x1="72"  y1="88"  x2="49"  y2="71"  stroke="rgba(99,179,237,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
            </svg>

            <h2 className="text-[1.6rem] font-bold leading-tight text-white">
              어르신의 안전을<br />실시간으로 살핍니다
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              AI가 24시간 활동을 모니터링하고<br />
              이상 징후를 보호자에게 즉시 알립니다
            </p>

            {/* 기능 목록 */}
            <div className="mt-10 w-full max-w-[260px] space-y-3 text-left">
              {features.map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/20">
                    <Icon className="size-3.5 text-blue-400" />
                  </div>
                  <span className="text-sm text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-slate-700">© 2025 어르신 안전 돌봄 서비스</p>
        </div>
      </div>

      {/* ── 오른쪽 폼 패널 ── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-slate-950 px-8 py-12">
        {/* 배경 글로우 (오른쪽) */}
        <div className="pointer-events-none absolute right-0 top-1/2 h-[400px] w-[300px] -translate-y-1/2 rounded-full bg-blue-700/10 blur-[100px]" />

        <div className="relative z-10 w-full max-w-sm">

          {/* 모바일 전용 로고 */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/20">
              <ShieldCheck className="size-4 text-blue-400" />
            </div>
            <span className="text-sm font-bold text-white">어르신 안전 돌봄 서비스</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">로그인</h1>
            <p className="mt-1.5 text-sm text-slate-400">계정 정보를 입력해주세요</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@email.com"
                className="h-11 border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-11 border-slate-700 bg-slate-800/60 pr-11 text-white placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword
                    ? <EyeOff className="size-4.5" />
                    : <Eye className="size-4.5" />
                  }
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* 로그인 실패 에러 배너 */}
            {loginError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? '로그인 중...' : '로그인하기'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
