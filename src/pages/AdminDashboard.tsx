import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Bell, AlertTriangle, ShieldCheck, LogOut, ChevronRight, UserPlus, UserCheck, Trash2, Loader2, X, Search, Mail, CalendarDays, Hash } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useSeenStore } from '@/lib/seen-store';
import { usePatientList } from '@/hooks/usePatientList';
import { useAllEvents } from '@/hooks/useAllEvents';
import { eventLevelCategory } from '@/lib/event-labels';
import type { EventLike } from '@/lib/event-labels';
import { riskScoreFromEvents, riskLevelFromScore } from '@/lib/risk';
import { formatKST } from '@/lib/format';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { GuardianListResponse, GuardianListItem, AdminRegisterGuardianRequest, RiskLevel } from '@/types/api';

const ALERT_TYPE_KO: Record<string, string> = {
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
const translateAlertType = (t: string) => ALERT_TYPE_KO[t] ?? t;

const levelColor: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-red-400',
  medium:   'text-amber-500',
  low:      'text-emerald-500',
};

const levelBg: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high:     'bg-red-500/10 text-red-400',
  medium:   'bg-amber-500/10 text-amber-400',
  low:      'bg-emerald-500/10 text-emerald-400',
};

const levelLabel: Record<string, string> = {
  critical: '위험',
  high:     '위험',
  medium:   '주의',
  low:      '안전',
};

// 이벤트 유형 기준 등급 라벨/색상 (다크 테마) — 낙상=위험 / 비정상=주의 / 정상=안전
function eventLevel(e: EventLike): { label: string; bg: string } {
  const c = eventLevelCategory(e);
  if (c === 'danger') return { label: '위험', bg: 'bg-red-500/15 text-red-400' };
  if (c === 'warning') return { label: '주의', bg: 'bg-amber-500/10 text-amber-400' };
  return { label: '안전', bg: 'bg-emerald-500/10 text-emerald-400' };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { data: patientData, isLoading: pLoading } = usePatientList();
  const { data: allEvents, isLoading: eLoading } = useAllEvents(200);
  const seenAt = useSeenStore((s) => s.seenAt);

  // 최근 7일 감지 이벤트 (최신순, 최대 20건)
  const recentEvents = useMemo(() => {
    if (!allEvents) return [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [...allEvents]
      .filter(e => new Date(e.ts_utc).getTime() >= cutoff)
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
      .slice(0, 20);
  }, [allEvents]);

  // 보호자 목록 — TanStack Query 캐시 우회, 직접 fetch
  const [guardianData, setGuardianData] = useState<GuardianListItem[]>([]);
  const [gLoading, setGLoading] = useState(true);

  const fetchGuardians = useCallback(async () => {
    setGLoading(true);
    try {
      const res = await apiFetch<GuardianListResponse>('/api/v1/admin/users?role=guardian');
      setGuardianData(res?.items ?? []);
    } catch {
      // apiFetch 에서 toast 처리
    } finally {
      setGLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuardians(); }, [fetchGuardians]);

  // 어르신 검색
  const [patientSearch, setPatientSearch] = useState('');

  // 보호자 검색 / 상세 모달
  const [guardianSearch, setGuardianSearch] = useState('');
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianListItem | null>(null);
  const guardianSectionRef = useRef<HTMLElement>(null);
  // 보호자 등록 폼 상태
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [gForm, setGForm] = useState({ email: '', password: '', patient_ids: '' });

  // 보호자 등록 mutation
  const registerGuardian = useMutation({
    mutationFn: (req: AdminRegisterGuardianRequest) =>
      apiFetch('/api/v1/admin/users/register', { method: 'POST', body: JSON.stringify(req) }),
    onSuccess: () => {
      fetchGuardians();
      toast.success('보호자 계정이 등록되었습니다');
      setShowGuardianForm(false);
      setGForm({ email: '', password: '', patient_ids: '' });
      setTimeout(() => {
        guardianSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    },
    onError: () => toast.error('보호자 등록에 실패했습니다'),
  });

  // 보호자 삭제 mutation
  const deleteGuardian = useMutation({
    mutationFn: (userId: number) =>
      apiFetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      fetchGuardians();
      toast.success('보호자 계정이 삭제되었습니다');
    },
    onError: () => toast.error('보호자 삭제에 실패했습니다'),
  });

  // 검색어로 필터링
  const filteredGuardians = useMemo(() => {
    if (!guardianData) return [];
    const q = guardianSearch.trim().toLowerCase();
    if (!q) return guardianData;
    return (guardianData as GuardianListItem[]).filter(
      g => g.email.toLowerCase().includes(q) ||
           g.patient_ids.some(c => c.toLowerCase().includes(q))
    );
  }, [guardianData, guardianSearch]);

  function handleGuardianSubmit() {
    if (!gForm.email.trim() || !gForm.password.trim()) {
      toast.error('이메일과 비밀번호를 입력해주세요');
      return;
    }
    const patient_ids = gForm.patient_ids
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    registerGuardian.mutate({
      email: gForm.email.trim(),
      password: gForm.password.trim(),
      patient_ids: patient_ids.length > 0 ? patient_ids : undefined,
    });
  }

  useEffect(() => {
    document.title = '관리자 대시보드 — 어르신 안전 돌봄 서비스';
  }, []);

  // 통일 위험점수 — 사건(incidents) 기준으로 계산 (2차 AI latest_risk_score 미사용)
  const patientRisk = useMemo(() => {
    const map: Record<string, { score: number | null; level: RiskLevel | null; ts: string | null }> = {};
    for (const p of (patientData ?? [])) {
      const pe = (allEvents ?? []).filter(e => e.patient_id === p.patient_id);
      const score = riskScoreFromEvents(pe);
      const ts = pe.length ? [...pe].sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())[0].ts_utc : null;
      map[p.patient_id] = { score, level: score != null ? riskLevelFromScore(score) : null, ts };
    }
    return map;
  }, [patientData, allEvents]);

  // 위험도 높은 순 정렬 (통일 점수 기준)
  const patients = useMemo(() => {
    const list = patientData ?? [];
    return [...list].sort((a, b) => {
      const ra = patientRisk[a.patient_id];
      const rb = patientRisk[b.patient_id];
      const sa = ra?.score ?? null;
      const sb = rb?.score ?? null;
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sb - sa;
    });
  }, [patientData, patientRisk]);

  // 검색어로 어르신 필터 (이름 또는 환자 ID)
  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      p => p.name.toLowerCase().includes(q) || p.patient_id.toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  // 알림에 환자 이름 매핑
  const patientMap = useMemo(() => {
    return Object.fromEntries((patientData ?? []).map(p => [p.patient_id, p.name]));
  }, [patientData]);

  const totalPatients  = patients.length;
  const dangerPatients = patients.filter(p => patientRisk[p.patient_id]?.level === 'high').length;
  // 위험 알림 = 최근 7일 위험(낙상 등) 감지 사건 수 — 최근 감지 목록·차트의 위험과 일치
  const criticalAlerts = allEvents?.filter(e =>
    Date.now() - new Date(e.ts_utc).getTime() < 7 * 24 * 60 * 60 * 1000 &&
    eventLevelCategory(e) === 'danger'
  ).length ?? 0;
  // 미확인 알림 = 위험 사건 중 아직 확인하지 않은 것 (벨/알림 페이지 확인 시 줄어듦)
  const seenMs = seenAt ? new Date(seenAt).getTime() : 0;
  const unreadAlerts = allEvents?.filter(e =>
    Date.now() - new Date(e.ts_utc).getTime() < 7 * 24 * 60 * 60 * 1000 &&
    eventLevelCategory(e) === 'danger' &&
    new Date(e.ts_utc).getTime() > seenMs
  ).length ?? 0;

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/20">
              <ShieldCheck className="size-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">관리자 대시보드</h1>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="size-3.5" />
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="전체 어르신"
            value={pLoading ? '-' : totalPatients}
            icon={<Users className="size-5 text-blue-400" />}
            color="border-blue-500/20 bg-blue-500/5"
          />
          <StatCard
            label="위험 어르신"
            value={pLoading ? '-' : dangerPatients}
            icon={<AlertTriangle className="size-5 text-red-400" />}
            color={dangerPatients > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-red-500/20 bg-red-500/5'}
          />
          <StatCard
            label="미확인 알림"
            value={eLoading ? '-' : unreadAlerts}
            icon={<Bell className="size-5 text-amber-400" />}
            color={unreadAlerts > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-500/20 bg-amber-500/5'}
          />
          <StatCard
            label="위험 알림 (7일)"
            value={eLoading ? '-' : criticalAlerts}
            icon={<AlertTriangle className="size-5 text-orange-400" />}
            color="border-orange-500/20 bg-orange-500/5"
          />
        </div>

        {/* 전체 어르신 목록 */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300">
              전체 어르신 현황
              <span className="ml-2 text-xs font-normal text-slate-500">위험도 높은 순</span>
            </h2>
            <button
              type="button"
              onClick={() => navigate('/register-patient')}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <UserPlus className="size-3.5" />
              어르신 등록
            </button>
          </div>

          {/* 검색 */}
          {!pLoading && patients.length > 0 && (
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="이름 또는 환자 ID로 검색..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
              {patientSearch && (
                <button
                  type="button"
                  onClick={() => setPatientSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {pLoading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
              불러오는 중...
            </div>
          ) : patients.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <Users className="mx-auto mb-3 size-8 text-slate-700" />
              <p className="text-sm text-slate-500">등록된 어르신이 없습니다.</p>
              <button
                type="button"
                onClick={() => navigate('/register-patient')}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                첫 어르신 등록하기
              </button>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">이름</th>
                    <th className="px-5 py-3 font-medium">성별</th>
                    <th className="px-5 py-3 font-medium">위험점수</th>
                    <th className="px-5 py-3 font-medium">상태</th>
                    <th className="px-5 py-3 font-medium">분석 시각</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPatients.map((p, idx) => {
                    const risk = patientRisk[p.patient_id];
                    const isDanger = risk?.level === 'high';
                    return (
                      <tr
                        key={p.patient_id}
                        className={`cursor-pointer transition-colors hover:bg-slate-800/60 ${
                          isDanger && idx === 0 ? 'bg-red-500/5' : ''
                        }`}
                        onClick={() => navigate(`/dashboard/${p.patient_id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {isDanger && (
                              <span className="size-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                            )}
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium text-white">{p.name}</span>
                              <span className="text-[11px] font-mono text-slate-500">{p.patient_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">{p.gender ?? '-'}</td>
                        <td className="px-5 py-3.5">
                          {risk?.score != null && risk.level ? (
                            <span className={`text-base font-bold ${levelColor[risk.level]}`}>
                              {risk.score.toFixed(1)}
                              <span className="ml-0.5 text-xs font-normal text-slate-600">/ 5</span>
                            </span>
                          ) : <span className="text-slate-600">-</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {risk?.level ? (
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelBg[risk.level]}`}>
                              {levelLabel[risk.level]}
                            </span>
                          ) : <span className="text-xs text-slate-600">-</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {risk?.ts ? formatKST(risk.ts) : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <ChevronRight className="size-4" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 최근 감지 이벤트 */}
        <section>
          <h2 className="mb-4 text-sm font-bold text-slate-300">최근 감지 (7일)</h2>
          {eLoading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
              불러오는 중...
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
              감지된 이벤트가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="max-h-[290px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-900">
                    <tr className="border-b border-slate-800 text-left text-xs text-slate-500 [&>th]:border-b [&>th]:border-slate-800">
                      <th className="px-5 py-3 font-medium">어르신</th>
                      <th className="px-5 py-3 font-medium">유형</th>
                      <th className="px-5 py-3 font-medium">등급</th>
                      <th className="px-5 py-3 font-medium">시각</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                  {recentEvents.map(e => {
                    const lv = eventLevel(e);
                    return (
                      <tr
                        key={e.id}
                        className="cursor-pointer transition-colors hover:bg-slate-800/50"
                        onClick={() => navigate(`/dashboard/${e.patient_id}`)}
                      >
                        <td className="px-5 py-3 font-medium text-white">
                          {patientMap[e.patient_id] ?? e.patient_id}
                        </td>
                        <td className="px-5 py-3 text-slate-300">{translateAlertType(e.event_type)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${lv.bg}`}>
                            {lv.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">{formatKST(e.ts_utc)}</td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* 보호자 관리 */}
        <section ref={guardianSectionRef}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300">
              보호자 관리
              <span className="ml-2 text-xs font-normal text-slate-500">
                {gLoading ? '...' : `${guardianData?.length ?? 0}명`}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setShowGuardianForm(v => !v)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-600"
            >
              {showGuardianForm ? <><X className="size-3.5" />닫기</> : <><UserPlus className="size-3.5" />보호자 등록</>}
            </button>
          </div>

          {/* 보호자 등록 폼 */}
          {showGuardianForm && (
            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-300">새 보호자 계정 등록</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">이메일 *</label>
                  <input
                    type="email"
                    value={gForm.email}
                    onChange={e => setGForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="guardian@example.com"
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">비밀번호 *</label>
                  <input
                    type="password"
                    value={gForm.password}
                    onChange={e => setGForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="8자 이상"
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  담당 환자 ID <span className="text-slate-600">(쉼표로 구분, 선택)</span>
                </label>
                <input
                  type="text"
                  value={gForm.patient_ids}
                  onChange={e => setGForm(f => ({ ...f, patient_ids: e.target.value }))}
                  placeholder="P001, P002"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowGuardianForm(false); setGForm({ email: '', password: '', patient_ids: '' }); }}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-400 hover:bg-slate-700"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleGuardianSubmit}
                  disabled={registerGuardian.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {registerGuardian.isPending
                    ? <><Loader2 className="size-3.5 animate-spin" />등록 중...</>
                    : <><UserCheck className="size-3.5" />등록</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* 검색 */}
          {!gLoading && guardianData && guardianData.length > 0 && (
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={guardianSearch}
                onChange={e => setGuardianSearch(e.target.value)}
                placeholder="이메일 또는 환자 ID로 검색..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
              {guardianSearch && (
                <button
                  type="button"
                  onClick={() => setGuardianSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {/* 보호자 목록 */}
          {gLoading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
              불러오는 중...
            </div>
          ) : !guardianData || guardianData.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
              등록된 보호자가 없습니다.
            </div>
          ) : filteredGuardians.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">이메일</th>
                    <th className="px-5 py-3 font-medium">담당 어르신</th>
                    <th className="px-5 py-3 font-medium">가입일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredGuardians.map(g => (
                    <tr
                      key={g.user_id}
                      className="cursor-pointer hover:bg-slate-800/40"
                      onClick={() => setSelectedGuardian(g)}
                    >
                      <td className="px-5 py-3.5 text-white align-top">{g.email}</td>
                      <td className="px-5 py-3.5 align-top">
                        {g.patient_ids.length === 0 ? (
                          <span className="text-xs text-slate-600">없음</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {g.patient_ids.map(code => (
                              <span
                                key={code}
                                className="inline-block rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-mono text-slate-300"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 align-top whitespace-nowrap">
                        {formatKST(g.created_at_utc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>

      {/* 보호자 상세 모달 */}
      {selectedGuardian && (
        <GuardianDetailModal
          guardian={selectedGuardian}
          patientMap={patientMap}
          onClose={() => setSelectedGuardian(null)}
          onDelete={(userId) => {
            if (confirm(`${selectedGuardian.email} 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
              deleteGuardian.mutate(userId);
              setSelectedGuardian(null);
            }
          }}
        />
      )}
    </div>
  );
}

function GuardianDetailModal({
  guardian,
  patientMap,
  onClose,
  onDelete,
}: {
  guardian: GuardianListItem;
  patientMap: Record<string, string>;
  onClose: () => void;
  onDelete: (userId: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* 헤더 */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-600/20 text-base font-bold text-blue-400">
            {guardian.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{guardian.email}</p>
            <p className="text-xs text-slate-500">보호자 계정</p>
          </div>
        </div>

        {/* 정보 목록 */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
          <InfoRow icon={<Hash className="size-3.5 text-slate-500" />} label="사용자 ID" value={String(guardian.user_id)} />
          <InfoRow icon={<Mail className="size-3.5 text-slate-500" />} label="이메일" value={guardian.email} />
          <InfoRow icon={<CalendarDays className="size-3.5 text-slate-500" />} label="가입일" value={formatKST(guardian.created_at_utc)} />
          <div className="flex gap-3 pt-1">
            <div className="mt-0.5 shrink-0">
              <Users className="size-3.5 text-slate-500" />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-slate-500">담당 어르신</p>
              {guardian.patient_ids.length === 0 ? (
                <p className="text-xs text-slate-600">없음</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {guardian.patient_ids.map(id => (
                    <span
                      key={id}
                      className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-mono text-slate-300"
                    >
                      {patientMap[id] ? `${patientMap[id]} (${id})` : id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 삭제 버튼 */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onDelete(guardian.user_id)}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/20"
          >
            <Trash2 className="size-3.5" />
            계정 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="mb-3">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
