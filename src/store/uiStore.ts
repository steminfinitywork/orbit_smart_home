import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppNotification, NotifType } from '@/types';

interface UIState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  notifications: AppNotification[];
  addNotification: (message: string, type: NotifType) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: true,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      notifications: [],
      addNotification: (message, type) =>
        set((s) => ({
          notifications: [
            { id: `${Date.now()}-${Math.random()}`, message, type, timestamp: Date.now(), read: false },
            ...s.notifications.slice(0, 49),
          ],
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      clearNotifications: () => set({ notifications: [] }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ darkMode: state.darkMode }),
    }
  )
);
