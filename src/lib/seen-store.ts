import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 알림(이벤트) 벨 배지용 "확인 시각" 저장소.
// 알림 패널을 열거나 알림 페이지를 방문하면 markSeen()으로 갱신 → 이후 들어온 이벤트만 미확인으로 집계.
interface SeenState {
  seenAt: string | null; // ISO timestamp
  markSeen: (ts?: string) => void;
}

export const useSeenStore = create<SeenState>()(
  persist(
    (set) => ({
      seenAt: null,
      markSeen: (ts) => set({ seenAt: ts ?? new Date().toISOString() }),
    }),
    { name: 'notif-seen' }
  )
);
