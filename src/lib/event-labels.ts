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

// 이벤트 severity 스케일(약 0~10: 정상=1, 비정상 움직임=5, 비정상 자세=6, 낙상=9)을
// 3단계 위험도로 매핑하는 단일 기준.
//   안전: severity < 3 / 주의: 3~6 / 위험: 7 이상
export type SeverityCategory = 'safe' | 'warning' | 'danger';

export function severityCategory(severity: number): SeverityCategory {
  if (severity >= 7) return 'danger';
  if (severity >= 3) return 'warning';
  return 'safe';
}

export function eventSeverityDot(severity: number): string {
  const c = severityCategory(severity);
  if (c === 'danger') return 'bg-red-500 animate-pulse';
  if (c === 'warning') return 'bg-amber-400';
  return 'bg-emerald-400';
}

export function eventSeverityBadge(severity: number): { color: string; label: string } {
  const c = severityCategory(severity);
  if (c === 'danger') return { color: 'bg-red-50 text-red-600 border-red-200', label: '위험' };
  if (c === 'warning') return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: '주의' };
  return { color: 'bg-green-50 text-green-600 border-green-200', label: '안전' };
}
