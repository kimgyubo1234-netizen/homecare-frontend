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

// 이벤트 위험도 3단계.
//   위험: 낙상 계열 / 주의: 비정상 자세·움직임·비활동 등 / 안전: 정상 활동
export type SeverityCategory = 'safe' | 'warning' | 'danger';

// 숫자 severity 폴백 (유형을 알 수 없을 때만 사용, 약 0~10 스케일)
export function severityCategory(severity: number): SeverityCategory {
  if (severity >= 7) return 'danger';
  if (severity >= 3) return 'warning';
  return 'safe';
}

// 이벤트 유형 우선 분류 — severity 스케일에 의존하지 않고 유형으로 결정.
//   낙상/추락/충돌 → 위험, 비정상·비활동·위험점수 → 주의, 정상/활동 → 안전
export function eventCategory(eventType: string, severity = 0): SeverityCategory {
  const t = (eventType ?? '').toLowerCase();
  if (t.includes('fall') || t.includes('drop') || t.includes('collision')) return 'danger';
  if (
    t.includes('abnormal') || t.includes('inactiv') || t.includes('no_activity') ||
    t.includes('no_move') || t.includes('stumble') || t.includes('bending') ||
    t.includes('balance') || t.includes('risk')
  ) return 'warning';
  if (
    t.includes('normal') || t.includes('activity') || t.includes('walking') ||
    t.includes('standing') || t.includes('sitting') || t.includes('motion')
  ) return 'safe';
  return severityCategory(severity);
}

export function eventSeverityDot(severity: number, eventType = ''): string {
  const c = eventType ? eventCategory(eventType, severity) : severityCategory(severity);
  if (c === 'danger') return 'bg-red-500 animate-pulse';
  if (c === 'warning') return 'bg-amber-400';
  return 'bg-emerald-400';
}

export function eventSeverityBadge(severity: number, eventType = ''): { color: string; label: string } {
  const c = eventType ? eventCategory(eventType, severity) : severityCategory(severity);
  if (c === 'danger') return { color: 'bg-red-50 text-red-600 border-red-200', label: '위험' };
  if (c === 'warning') return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: '주의' };
  return { color: 'bg-green-50 text-green-600 border-green-200', label: '안전' };
}
