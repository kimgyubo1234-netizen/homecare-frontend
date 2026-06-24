import type { RiskLevel } from '@/types/api';
import { eventLevelCategory, type EventLike } from '@/lib/event-labels';

// 위험점수(5점 만점) → 등급. 1~2 안전 / 3~4 주의 / 5 위험
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

// 사건(incident) 위험도 카테고리 → 5점 척도 가중치
const CATEGORY_SCORE: Record<ReturnType<typeof eventLevelCategory>, number> = {
  danger: 5,
  warning: 3,
  safe: 1,
};

// 최근 사건들의 위험도 카테고리 평균 → 0~5 위험점수 (데이터 없으면 null)
//   1순위: 최근 5분 이내 / 없으면 최근 10건
//   incident에는 risk_score가 없으므로 유형 분류(낙상=위험 등) 기준으로 환산한다.
export function riskScoreFromEvents(events: (EventLike & { ts_utc: string })[]): number | null {
  if (!events || events.length === 0) return null;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  let win = events.filter(e => now - new Date(e.ts_utc).getTime() <= windowMs);
  if (win.length === 0) {
    win = [...events]
      .sort((a, b) => new Date(b.ts_utc).getTime() - new Date(a.ts_utc).getTime())
      .slice(0, 10);
  }
  if (win.length === 0) return null;
  const scores = win.map(e => CATEGORY_SCORE[eventLevelCategory(e)]);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(5, Math.max(0, avg));
}
