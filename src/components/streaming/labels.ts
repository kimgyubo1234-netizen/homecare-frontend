export const ACTIVITY_LABEL_KO: Record<string, string> = {
  standing:          '서 있는 중',
  walking:           '걷는 중',
  sitting:           '앉아 있는 중',
  sitting_down:      '앉는 중',
  standing_up:       '일어나는 중',
  lying_rest:        '누워 있는 중',
  no_move_short:     '잠시 정지',
  no_move_long:      '장시간 정지',
  bending_long:      '구부린 자세 유지',
  near_fall:         '낙상 전조',
  stumble:           '비틀거림',
  loss_of_balance:   '균형 상실',
  sudden_drop:       '급격한 낙하',
  fall_candidate:    '낙상 의심',
  fall_confirmed:    '낙상 확정',
  fall_then_no_move: '낙상 후 미동',
  unknown:           '분석 중',
};

export const RISK_COLOR = {
  NORMAL:   { bg: 'rgba(34, 197, 94, 0.2)',  border: '#22c55e', text: '#86efac', label: '정상' },
  ABNORMAL: { bg: 'rgba(234, 179, 8, 0.2)',  border: '#eab308', text: '#fde047', label: '주의' },
  DANGER:   { bg: 'rgba(239, 68, 68, 0.2)',  border: '#ef4444', text: '#fca5a5', label: '위험' },
} as const;

export type RiskLabelKey = keyof typeof RISK_COLOR;

export function getActivityLabel(key: string): string {
  return ACTIVITY_LABEL_KO[key] ?? '알 수 없는 행동';
}
