import { useEffect, useRef, useState } from 'react';
import type { ActionEvent } from '@/types/api';
import { RISK_COLOR, getActivityLabel } from './labels';
import type { RiskLabelKey } from './labels';

interface Props {
  event: ActionEvent | null;
  isConnected: boolean;
  isDelayed: boolean;
}

function formatTimeKST(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function ActionOverlayPanel({ event, isConnected, isDelayed }: Props) {
  const riskKey: RiskLabelKey =
    event?.risk_label && event.risk_label in RISK_COLOR
      ? (event.risk_label as RiskLabelKey)
      : 'NORMAL';
  const colors = RISK_COLOR[riskKey];

  // activity 변경 시 fade 애니메이션
  const [visible, setVisible] = useState(true);
  const [displayLabel, setDisplayLabel] = useState(event?.activity_label ?? '');
  const prevLabelRef = useRef(event?.activity_label ?? '');

  useEffect(() => {
    const next = event?.activity_label ?? '';
    if (next === prevLabelRef.current) return;

    setVisible(false);
    const timer = setTimeout(() => {
      prevLabelRef.current = next;
      setDisplayLabel(next);
      setVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [event?.activity_label]);

  // DANGER pulse 상태
  const isDanger = riskKey === 'DANGER';

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    border: isDanger
      ? `1px solid ${colors.border}`
      : '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    backdropFilter: 'none',
  };

  // 연결 중 상태
  if (!isConnected && !event) {
    return (
      <div style={panelStyle}>
        <p className="text-xs text-slate-400 text-center">서버 연결 중...</p>
      </div>
    );
  }

  // 추론 대기 (연결됐지만 데이터 없음)
  if (!event) {
    return (
      <div style={panelStyle}>
        <p className="text-xs text-slate-400 text-center">추론 대기 중...</p>
      </div>
    );
  }

  return (
    <div
      style={panelStyle}
      className={isDanger ? 'animate-danger-pulse' : undefined}
    >
      {/* 행동 라벨 */}
      <div className="flex items-center gap-3">
        <div
          className="text-xs font-bold text-slate-700 transition-opacity duration-300 shrink-0"
          style={{ opacity: visible ? 1 : 0 }}
        >
          현재 행동: {getActivityLabel(displayLabel || event.activity_label)}
        </div>
        <span
          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          }}
        >
          {colors.label}
        </span>
        <span className="text-[11px] text-slate-400 shrink-0">
          위험도 {Math.max(1, Math.min(5, Math.round(event.risk_score * 5)))}
        </span>
        <span className="text-[10px] text-slate-400 shrink-0">
          {formatTimeKST(event.capture_ts)}
        </span>
        {isDelayed && (
          <span className="text-[10px] text-yellow-500 shrink-0" title="데이터 수신 지연">
            ⚠ 지연
          </span>
        )}
      </div>
    </div>
  );
}
