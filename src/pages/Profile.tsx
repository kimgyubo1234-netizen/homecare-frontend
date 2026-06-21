import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Lock, Bell, ChevronLeft, Check, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { restartTour } from '@/components/OnboardingTour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthUser } from '@/lib/auth-store';

// ── Toggle 컴포넌트 ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked ? 'bg-blue-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── 타입 ─────────────────────────────────────────────────────────────────────

type MinLevel = 'all' | 'medium' | 'high';

interface NotifSettings {
  fall: boolean;
  inactivity: boolean;
  riskScore: boolean;
  dailyReport: boolean;
  minLevel: MinLevel;
}

// ── 페이지 ───────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthUser();

  const [profileForm, setProfileForm] = useState({
    name: user?.email.split('@')[0] ?? '',
    phone: '',
  });

  function saveProfile() {
    toast.success('저장되었습니다');
  }

  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  const [notif, setNotif] = useState<NotifSettings>({
    fall: true,
    inactivity: true,
    riskScore: false,
    dailyReport: false,
    minLevel: 'all',
  });

  useEffect(() => {
    document.title = '내 프로필 — 안전 돌봄 서비스';
  }, []);

  function savePw() {
    if (!pwForm.current) { toast.error('현재 비밀번호를 입력해주세요'); return; }
    if (pwForm.next.length < 8) { toast.error('새 비밀번호는 8자 이상이어야 합니다'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('새 비밀번호가 일치하지 않습니다'); return; }
    toast.success('비밀번호가 변경되었습니다');
    setPwForm({ current: '', next: '', confirm: '' });
    setShowPw({ current: false, next: false, confirm: false });
  }

  function saveNotif() {
    toast.success('알림 설정이 저장되었습니다', { description: '변경된 설정이 즉시 적용됩니다.' });
  }

  const toggleNotif =
    (k: keyof Omit<NotifSettings, 'minLevel'>) =>
    (v: boolean) =>
      setNotif(n => ({ ...n, [k]: v }));

  const pwFields = [
    { key: 'current' as const, label: '현재 비밀번호', hint: undefined },
    { key: 'next' as const,    label: '새 비밀번호',   hint: '8자 이상' },
    { key: 'confirm' as const, label: '새 비밀번호 확인', hint: undefined },
  ];

  const notifItems: { key: keyof Omit<NotifSettings, 'minLevel'>; label: string; desc: string }[] = [
    { key: 'fall',         label: '낙상 감지 알림',      desc: '낙상이 감지되면 즉시 알림을 받습니다' },
    { key: 'inactivity',   label: '장시간 비활동 알림',  desc: '12시간 이상 활동이 없으면 알립니다' },
    { key: 'riskScore',    label: '위험점수 상승 알림',  desc: '위험점수가 4점 이상(5점 만점)으로 오르면 알립니다' },
    { key: 'dailyReport',  label: '일일 안전 리포트',    desc: '매일 오전 8시에 전날 요약 리포트를 받습니다' },
  ];

  const minLevelOptions: { v: MinLevel; label: string; badge: string }[] = [
    { v: 'all',    label: '전체',    badge: '낮음 포함' },
    { v: 'medium', label: '주의 이상', badge: '주의·위험' },
    { v: 'high',   label: '위험만',  badge: '위험 only' },
  ];

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 transition-colors font-medium"
      >
        <ChevronLeft className="size-4" />
        뒤로가기
      </button>

      {/* 프로필 헤더 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-950 p-6 text-white">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 right-1/4 size-24 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-4 ring-white/10 text-2xl font-extrabold select-none">
            {user?.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-bold">{user?.email.split('@')[0]} 님</p>
            <p className="text-sm text-blue-200 mt-0.5">{user?.email}</p>
            <Badge className="mt-2 bg-white/15 text-white border-white/20 capitalize hover:bg-white/15">
              {user?.role === 'admin' ? '관리자' : '보호자'}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── 계정 정보 ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <div className="h-0.5 w-full bg-blue-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <User className="size-4 text-blue-600" />
            계정 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 이름 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">이름</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
              placeholder="이름을 입력하세요"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          {/* 이메일 (읽기 전용) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">이메일</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="flex-1 text-sm text-slate-600">{user?.email}</span>
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 shrink-0">읽기 전용</Badge>
            </div>
          </div>

          {/* 전화번호 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">전화번호</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          {/* 권한 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">권한</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-600">{user?.role === 'admin' ? '관리자' : '보호자'}</span>
              {user?.role === 'admin' && (
                <Badge className="ml-auto text-[10px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
                  관리자
                </Badge>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={saveProfile}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Check className="size-4" />
              저장하기
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── 비밀번호 변경 ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <div className="h-0.5 w-full bg-slate-300" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="size-4 text-slate-600" />
            비밀번호 변경
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwFields.map(({ key, label, hint }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                {label}
                {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">({hint})</span>}
              </label>
              <div className="relative">
                <input
                  type={showPw[key] ? 'text' : 'password'}
                  value={pwForm[key]}
                  onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={savePw}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              비밀번호 변경
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── 알림 설정 ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <div className="h-0.5 w-full bg-amber-400" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4 text-amber-600" />
            알림 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 토글 목록 */}
          <div className="space-y-5">
            {notifItems.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle checked={notif[key]} onChange={toggleNotif(key)} />
              </div>
            ))}
          </div>

          {/* 최소 알림 수준 */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-800">최소 알림 수준</p>
              <p className="text-xs text-slate-400 mt-0.5">설정한 수준 이상의 알림만 받습니다</p>
            </div>
            <div className="flex gap-2">
              {minLevelOptions.map(({ v, label, badge }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNotif(n => ({ ...n, minLevel: v }))}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-all ${
                    notif.minLevel === v
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <p>{label}</p>
                  <p className={`text-[10px] mt-0.5 ${notif.minLevel === v ? 'text-blue-200' : 'text-slate-400'}`}>
                    {badge}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveNotif}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Check className="size-4" />
              설정 저장
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── 서비스 안내 ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <div className="h-0.5 w-full bg-slate-200" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle className="size-4 text-slate-500" />
            서비스 안내
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">온보딩 투어 다시 보기</p>
              <p className="text-xs text-slate-400 mt-0.5">서비스 주요 기능을 단계별로 다시 안내받습니다</p>
            </div>
            <button
              type="button"
              onClick={() => { restartTour(); navigate('/dashboard'); }}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              투어 시작
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
