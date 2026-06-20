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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    border: isDanger
      ? `1px solid ${colors.border}`
      : '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '12px 16px',
    minWidth: '200px',
    maxWidth: '280px',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  };

  // 연결 중 상태
  if (!isConnected && !event) {
    return (
      <div style={panelStyle}>
        <p className="text-xs text-white/60 text-center">서버 연결 중...</p>
      </div>
    );
  }

  // 추론 대기 (연결됐지만 데이터 없음)
  if (!event) {
    return (
      <div style={panelStyle}>
        <p className="text-xs text-white/60 text-center">추론 대기 중...</p>
      </div>
    );
  }

  return (
    <div
      style={panelStyle}
      className={isDanger ? 'animate-danger-pulse' : undefined}
    >
      {/* 행동 라벨 */}
      <div
        className="text-sm font-bold text-white mb-1.5 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        현재 행동: {getActivityLabel(displayLabel || event.activity_label)}
      </div>

      {/* 위험도 뱃지 */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          }}
        >
          {colors.label}
        </span>
        <span className="text-xs text-white/70">
          위험도 {event.risk_score.toFixed(2)}
        </span>
      </div>

      {/* 촬영 시각 + 지연 아이콘 */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[11px] text-white/50">
          {formatTimeKST(event.capture_ts)}
        </span>
        {isDelayed && (
          <span className="text-[11px] text-yellow-400" title="데이터 수신 지연">
            ⚠ 지연
          </span>
        )}
      </div>
    </div>
  );
}
