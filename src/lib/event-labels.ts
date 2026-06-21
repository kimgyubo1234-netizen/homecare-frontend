export const EVENT_TYPE_KO: Record<string, string> = {
  fall: '낙상',
  fall_detected: '낙상 감지',
  fall_risk: '낙상 위험',
  abnormal_posture: '비정상 자세',
  abnormal_motion: '비정상 움직임',
  normal_activity: '정상 활동',
  no_activity: '활동 없음',
  inactive: '비활동 감지',
  motion_detected: '움직임 감지',
  risk_score_high: '위험점수 상승',
  long_inactivity: '장시간 비활동',
  activity: '활동 감지',
  backend_integration_test: '연동 테스트',
  backend_self_test: '자체 점검',
};

export function translateEventType(type: string): string {
  return EVENT_TYPE_KO[type] ?? type;
}

export function eventSeverityDot(severity: number): string {
  if (severity >= 3) return 'bg-red-500 animate-pulse';
  if (severity === 2) return 'bg-amber-400';
  return 'bg-emerald-400';
}

export function eventSeverityBadge(severity: number): { color: string; label: string } {
  if (severity >= 3) return { color: 'bg-red-50 text-red-600 border-red-200', label: '위험' };
  if (severity === 2) return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: '주의' };
  return { color: 'bg-green-50 text-green-600 border-green-200', label: '양호' };
}
