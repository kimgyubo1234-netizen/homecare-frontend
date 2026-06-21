import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ChevronRight, ChevronLeft, User, Camera, ClipboardCheck, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthUser } from '@/lib/auth-store';
import { apiFetch } from '@/lib/api';
import type { AdminRegisterPatientResponse } from '@/types/api';

const STEPS = ['기본 정보', '모니터링 설정', '등록 확인'] as const;

interface FormData {
  name: string;
  birthDate: string;
  gender: '' | '남성' | '여성' | '기타';
  deviceKey: string;
  streamPath: string;
  notes: string;
}

const INITIAL: FormData = {
  name: '', birthDate: '', gender: '', deviceKey: '', streamPath: '', notes: '',
};

export default function RegisterPatient() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const isAdmin = user?.role === 'admin';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = '어르신 등록 — 안전 돌봄 서비스';
  }, []);

  function validateStep1() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = '이름을 입력해주세요';
    if (!form.gender) e.gender = '성별을 선택해주세요';
    return e;
  }

  function validateStep2() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.deviceKey.trim()) e.deviceKey = '디바이스 키를 입력해주세요';
    if (!form.streamPath.trim()) e.streamPath = '스트림 경로를 입력해주세요';
    return e;
  }

  function goNext() {
    const errs = step === 1 ? validateStep1() : step === 2 ? validateStep2() : {};
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(s => (s + 1) as 1 | 2 | 3);
  }

  function goBack() {
    setErrors({});
    setStep(s => (s - 1) as 1 | 2 | 3);
  }

  async function handleSubmit() {
    if (isAdmin) {
      setSubmitting(true);
      try {
        // 1. 환자 등록
        const patientRes = await apiFetch<AdminRegisterPatientResponse>(
          '/api/v1/admin/patients/register',
          {
            method: 'POST',
            body: JSON.stringify({
              name: form.name,
              birth_date: form.birthDate || undefined,
              gender: form.gender || undefined,
              notes: form.notes || undefined,
            }),
          }
        );

        // 2. 디바이스 등록
        await apiFetch('/api/v1/admin/devices/register', {
          method: 'POST',
          body: JSON.stringify({
            device_key: form.deviceKey,
            type: 'camera',
            stream_path: form.streamPath,
            patient_id: patientRes.patient_id,
          }),
        });

        toast.success(`${form.name} 어르신이 등록되었습니다`, {
          description: '실시간 모니터링이 즉시 시작됩니다.',
          duration: 5000,
        });
        navigate('/admin');
      } catch {
        toast.error('등록 중 오류가 발생했습니다', {
          description: '잠시 후 다시 시도해주세요.',
          duration: 4000,
        });
      } finally {
        setSubmitting(false);
      }
    } else {
      toast.success(`${form.name} 어르신 등록 요청이 접수되었습니다`, {
        description: '관리자가 검토 후 모니터링을 시작합니다.',
        duration: 5000,
      });
      navigate('/dashboard');
    }
  }

  function set(k: keyof FormData) {
    return (v: string) => setForm(f => ({ ...f, [k]: v }));
  }

  const stepBarWidth = step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full';

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

      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600">
          <User className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">어르신 등록</h1>
          <p className="text-xs text-slate-400">새 어르신을 모니터링 시스템에 등록합니다</p>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="space-y-3">
        <div className="flex items-center">
          {STEPS.map((label, i) => {
            const idx = i + 1;
            const isDone = step > idx;
            const isCurrent = step === idx;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isDone ? 'bg-blue-600 border-blue-600 text-white' :
                    isCurrent ? 'bg-white border-blue-600 text-blue-600' :
                    'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {isDone ? <Check className="size-3.5" /> : idx}
                  </div>
                  <span className={`text-sm font-medium whitespace-nowrap ${
                    isCurrent || isDone ? 'text-blue-600' : 'text-slate-400'
                  }`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 transition-colors ${step > idx ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
        {/* 진행 바 */}
        <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full bg-blue-600 transition-all duration-500 ${stepBarWidth}`} />
        </div>
      </div>

      {/* 폼 카드 */}
      <Card className="overflow-hidden shadow-sm">

        {/* Step 1 — 기본 정보 */}
        {step === 1 && (
          <>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-blue-600" />
                기본 정보 입력
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* 이름 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder="예: 홍길동"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                    errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                  }`}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* 생년월일 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">생년월일</label>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={e => set('birthDate')(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              {/* 성별 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  성별 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {(['남성', '여성', '기타'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set('gender')(g)}
                      className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all ${
                        form.gender === g
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2 — 모니터링 설정 */}
        {step === 2 && (
          <>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="size-4 text-blue-600" />
                모니터링 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* 디바이스 키 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  디바이스 키 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.deviceKey}
                  onChange={e => set('deviceKey')(e.target.value)}
                  placeholder="예: DEV-001"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                    errors.deviceKey ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                  }`}
                />
                {errors.deviceKey && <p className="text-xs text-red-500">{errors.deviceKey}</p>}
                <p className="text-xs text-slate-400">라즈베리파이에 등록된 디바이스 식별 코드입니다</p>
              </div>

              {/* 스트림 경로 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  카메라 스트림 경로 <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    카메라 경로
                  </span>
                  <input
                    type="text"
                    value={form.streamPath}
                    onChange={e => set('streamPath')(e.target.value)}
                    placeholder="patient_001"
                    className={`flex-1 rounded-r-lg border px-3 py-2.5 text-sm font-mono outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                      errors.streamPath ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                    }`}
                  />
                </div>
                {errors.streamPath && <p className="text-xs text-red-500">{errors.streamPath}</p>}
                <p className="text-xs text-slate-400">mediamtx에 등록된 스트림 식별자입니다</p>
              </div>

              {/* 메모 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  메모 <span className="text-slate-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes')(e.target.value)}
                  rows={3}
                  placeholder="특이사항, 주의사항 등을 입력해주세요"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                />
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3 — 확인 */}
        {step === 3 && (
          <>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="size-4 text-blue-600" />
                등록 정보 확인
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden divide-y divide-slate-100">
                {[
                  { label: '이름', value: form.name },
                  { label: '생년월일', value: form.birthDate || '미입력' },
                  { label: '성별', value: form.gender || '미입력' },
                  { label: '디바이스 키', value: form.deviceKey, mono: true },
                  { label: '스트림 경로', value: form.streamPath, mono: true },
                  ...(form.notes ? [{ label: '메모', value: form.notes }] : []),
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-start gap-4 px-4 py-3">
                    <span className="text-xs text-slate-400 w-24 shrink-0 mt-0.5">{label}</span>
                    <span className={`text-sm font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
                <div className="size-4 rounded-full bg-blue-200 flex items-center justify-center mt-0.5 shrink-0">
                  <span className="text-blue-700 text-[10px] font-bold">i</span>
                </div>
                <p className="text-sm text-blue-700">
                  {isAdmin
                    ? '등록 완료 즉시 실시간 모니터링이 시작됩니다.'
                    : '등록 요청 후 관리자가 검토하면 실시간 모니터링이 시작됩니다.'}
                </p>
              </div>
            </CardContent>
          </>
        )}

        {/* 하단 버튼 */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="size-4" />
              이전
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              다음
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 className="size-4 animate-spin" />등록 중...</>
                : <><Check className="size-4" />{isAdmin ? '등록 완료' : '등록 요청하기'}</>
              }
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
