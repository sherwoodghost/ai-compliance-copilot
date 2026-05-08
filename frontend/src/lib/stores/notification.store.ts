import { create } from 'zustand';

export interface AppNotification {
  id:        string;
  type:      string;
  title:     string;
  body?:     string;
  href?:     string;
  priority:  string;
  readAt:    string | null;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount:   number;

  /** Seed from REST API on mount. */
  init: (notifications: AppNotification[], unreadCount: number) => void;

  /** Prepend a new real-time notification (from WebSocket). */
  add: (n: AppNotification) => void;

  /** Mark one notification as read (optimistic). */
  markRead: (id: string) => void;

  /** Mark all as read (optimistic). */
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount:   0,

  init(notifications, unreadCount) {
    set({ notifications, unreadCount });
  },

  add(n) {
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 50), // keep max 50 in memory
      unreadCount:   s.unreadCount + (n.readAt ? 0 : 1),
    }));
  },

  markRead(id) {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - (s.notifications.find((n) => n.id === id && !n.readAt) ? 1 : 0)),
    }));
  },

  markAllRead() {
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  },
}));
