import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

const STORAGE_KEY = 'onboarding_v1';
const BUBBLE_W = 280;
const GAP = 16;
const SPOT_PAD = 8;

interface TourStep {
  selector?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  title: string;
  body: string;
  emoji: string;
}

const STEPS: TourStep[] = [
  {
    title: '안전 돌봄 서비스에 오신 것을 환영합니다!',
    body: '독거노인 실시간 모니터링 시스템입니다. 주요 기능을 간단히 안내해 드릴게요.',
    emoji: '👋',
  },
  {
    selector: '[data-tour="brand-logo"]',
    placement: 'bottom',
    title: '안전 모니터링 대시보드',
    body: '등록된 어르신들의 실시간 상태를 한눈에 확인합니다. 카드 색상이 위험 수준을 나타내요.',
    emoji: '🏠',
  },
  {
    selector: '[data-tour="nav-alerts"]',
    placement: 'bottom',
    title: '알림 내역',
    body: '낙상 감지, 비활동 등 이상 징후를 날짜별로 확인하고 관리할 수 있습니다. 새 알림은 숫자 배지로 표시돼요.',
    emoji: '🔔',
  },
  {
    selector: '[data-tour="user-section"]',
    placement: 'bottom',
    title: '내 계정 정보',
    body: '현재 로그인된 계정입니다. 프로필 / 알림 설정 변경은 대시보드에서 접근할 수 있어요.',
    emoji: '⚙️',
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

function getSpotlightStyle(r: Rect): React.CSSProperties {
  return {
    position: 'fixed',
    top: r.top - SPOT_PAD,
    left: r.left - SPOT_PAD,
    width: r.width + SPOT_PAD * 2,
    height: r.height + SPOT_PAD * 2,
    borderRadius: 10,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
    border: '2px solid rgba(255,255,255,0.35)',
    transition: 'top 0.35s ease, left 0.35s ease, width 0.35s ease, height 0.35s ease',
    pointerEvents: 'none',
  };
}

function getBubblePos(r: Rect, placement: TourStep['placement']): React.CSSProperties {
  const safeLeft = (v: number) => Math.max(8, Math.min(window.innerWidth - BUBBLE_W - 8, v));
  const safeTop  = (v: number) => Math.max(8, v);
  switch (placement) {
    case 'right':
      return { position: 'fixed', left: r.left + r.width + GAP, top: safeTop(r.top + r.height / 2 - 90), width: BUBBLE_W };
    case 'bottom':
      return { position: 'fixed', left: safeLeft(r.left + r.width / 2 - BUBBLE_W / 2), top: r.top + r.height + GAP, width: BUBBLE_W };
    case 'top':
      return { position: 'fixed', left: safeLeft(r.left + r.width / 2 - BUBBLE_W / 2), top: safeTop(r.top - GAP - 190), width: BUBBLE_W };
    case 'left':
      return { position: 'fixed', left: r.left - BUBBLE_W - GAP, top: safeTop(r.top + r.height / 2 - 90), width: BUBBLE_W };
    default:
      return {};
  }
}

function getArrowStyle(placement: TourStep['placement'], r: Rect, bubbleLeft: number): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', width: 14, height: 14, backgroundColor: 'white', transform: 'rotate(45deg)' };
  const arrowH = Math.max(12, Math.min(BUBBLE_W - 26, r.left + r.width / 2 - bubbleLeft - 7));
  switch (placement) {
    case 'right':  return { ...base, left: -7,  top: '38%', borderLeft: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' };
    case 'bottom': return { ...base, top: -7,   left: arrowH, borderTop: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0' };
    case 'top':    return { ...base, bottom: -7, left: arrowH, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' };
    case 'left':   return { ...base, right: -7, top: '38%', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' };
    default:       return {};
  }
}

export function restartTour() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('tour:restart'));
}

export default function OnboardingTour() {
  const [done, setDone] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // 투어가 처음 표시되는 순간 완료 여부를 저장 — X 없이 닫거나 새로고침해도 다시 뜨지 않음
  useEffect(() => {
    if (!done) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = () => { setDone(false); setStep(0); };
    window.addEventListener('tour:restart', h);
    return () => window.removeEventListener('tour:restart', h);
  }, []);

  useEffect(() => {
    if (done) return;
    const current = STEPS[step];
    if (!current.selector) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(current.selector!);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step, done]);

  if (done) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    setDone(true);
  }

  const bubblePos: React.CSSProperties = rect
    ? getBubblePos(rect, current.placement)
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 360 };

  const bubbleLeft = typeof bubblePos.left === 'number' ? bubblePos.left : 0;
  const arrowStyle = rect ? getArrowStyle(current.placement, rect, bubbleLeft) : {};

  return (
    <>
      {/* Overlay / spotlight */}
      <div className="fixed inset-0 z-[99] pointer-events-none">
        {rect
          ? <div style={getSpotlightStyle(rect)} />
          : <div className="fixed inset-0 bg-black/65" />
        }
      </div>

      {/* Speech bubble */}
      <div
        className="z-[100] rounded-2xl bg-white shadow-2xl border border-slate-100 p-5"
        style={{ ...bubblePos, pointerEvents: 'auto' }}
      >
        {rect && <div style={arrowStyle} />}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 text-2xl leading-none">{current.emoji}</span>
            <h3 className="text-sm font-bold text-slate-800 leading-snug">{current.title}</h3>
          </div>
          <button onClick={finish} className="shrink-0 p-0.5 text-slate-300 hover:text-slate-500 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">{current.body}</p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === step ? 'w-4 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                이전
              </button>
            )}
            <button
              onClick={() => isLast ? finish() : setStep(s => s + 1)}
              className="flex items-center gap-0.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              {isLast ? '시작하기' : '다음'}
              {!isLast && <ChevronRight className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
