import { create } from 'zustand';

export type NotificationType = 'deposit' | 'withdrawal';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    amount: number;
    currency: string;
    clientId: string;
    timestamp: string;
    read: boolean;
}

interface NotificationStore {
    notifications: AppNotification[];
    addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    unreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    addNotification: (notif) => set((state) => {
        // Prevent duplicates by checking if an exact same recent notification exists (optional)
        return {
            notifications: [
                {
                    ...notif,
                    id: `${notif.type}-${notif.clientId}-${notif.amount}-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    read: false,
                },
                ...state.notifications,
            ].slice(0, 100), // Keep last 100 notifications
        };
    }),
    markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        ),
    })),
    markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
    clearAll: () => set({ notifications: [] }),
    unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
