import { useEffect, useRef, useState } from 'react';
import type { IncidentEvent } from '@/types/api';
import { RISK_COLOR } from './labels';
import type { RiskLabelKey } from './labels';
import { eventLevelCategory, translateEventType } from '@/lib/event-labels';
import type { SeverityCategory } from '@/lib/event-labels';

interface Props {
  event: IncidentEvent | null;
  isConnected: boolean;
  isDelayed: boolean;
}

// 사건 위험도 카테고리 → 오버레이 색상/위험도 점수 매핑
const CAT_TO_RISK: Record<SeverityCategory, RiskLabelKey> = {
  danger: 'DANGER',
  warning: 'ABNORMAL',
  safe: 'NORMAL',
};
const CAT_TO_SCORE: Record<SeverityCategory, number> = { danger: 5, warning: 3, safe: 1 };

export default function ActionOverlayPanel({ event, isConnected, isDelayed }: Props) {
  const cat: SeverityCategory = event ? eventLevelCategory(event) : 'safe';
  const riskKey = CAT_TO_RISK[cat];
  const colors = RISK_COLOR[riskKey];

  // 상태(유형) 변경 시 fade 애니메이션
  const label = event ? translateEventType(event.incident_type) : '';
  const [visible, setVisible] = useState(true);
  const [displayLabel, setDisplayLabel] = useState(label);
  const prevLabelRef = useRef(label);

  useEffect(() => {
    if (label === prevLabelRef.current) return;
    setVisible(false);
    const timer = setTimeout(() => {
      prevLabelRef.current = label;
      setDisplayLabel(label);
      setVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [label]);

  const isDanger = riskKey === 'DANGER';

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    border: isDanger ? `1px solid ${colors.border}` : '1px solid #e2e8f0',
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

  // 최근 사건이 없거나 오래됐으면(60초 초과) 기본값은 "안전"
  if (!event || isDelayed) {
    const safe = RISK_COLOR.NORMAL;
    return (
      <div style={{ ...panelStyle, border: '1px solid #e2e8f0' }}>
        <div className="text-[11px] font-bold text-slate-700 truncate">
          현재 상태: 안전
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: safe.bg, border: `1px solid ${safe.border}`, color: safe.text }}
          >
            안전
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">위험도 1</span>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle} className={isDanger ? 'animate-danger-pulse' : undefined}>
      <div
        className="text-[11px] font-bold text-slate-700 transition-opacity duration-300 truncate"
        style={{ opacity: visible ? 1 : 0 }}
      >
        현재 상태: {displayLabel || label}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
        >
          {colors.label}
        </span>
        <span className="text-[10px] text-slate-400 shrink-0">위험도 {CAT_TO_SCORE[cat]}</span>
      </div>
    </div>
  );
}
