import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReadState {
  readIds: number[];
  markRead: (ids: number[]) => void;
  isRead: (id: number) => boolean;
}

export const useReadStore = create<ReadState>()(
  persist(
    (set, get) => ({
      readIds: [],
      markRead: (ids) =>
        set((s) => ({ readIds: [...new Set([...s.readIds, ...ids])] })),
      isRead: (id) => get().readIds.includes(id),
    }),
    { name: 'read-alerts' }
  )
);
