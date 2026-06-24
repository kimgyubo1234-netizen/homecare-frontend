import type { RiskLevel } from '@/types/api';

// 위험점수(5점 만점) → 등급. 1~2 안전 / 3~4 주의 / 5 위험
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

// 최근 액션 이벤트들의 risk_score 평균 → 0~5 위험점수 (데이터 없으면 null)
//   1순위: 최근 5분 이내 / 없으면 최근 10건
export function avgRiskScore(events: { ts_utc: string; risk_score?: number | null }[]): number | null {
  if (!events || events.length === 0) return null;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  let win = events.filter(e => now - new Date(e.ts_utc).getTime() <= windowMs);
  if (win.length === 0) {
    win = [...events]
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
      .slice(0, 10);
  }
  const scores = win
    .map(e => e.risk_score)
    .filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(5, Math.max(0, avg * 5));
}
