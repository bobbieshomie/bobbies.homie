'use client';

import { create } from 'zustand';
import type { InAppNotification } from '@/types/notification';

interface NotificationState {
  notifications: InAppNotification[];
  readIds: Set<string>;
  isOpen: boolean;
  setNotifications: (items: InAppNotification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'bobbies_read_notification_ids';

function getStoredReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveStoredReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage quota errors
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  readIds: getStoredReadIds(),
  isOpen: false,

  setNotifications: (items) => {
    set({ notifications: items });
  },

  markAsRead: (id) => {
    const next = new Set(get().readIds);
    next.add(id);
    saveStoredReadIds(next);
    set({ readIds: next });
  },

  markAllAsRead: () => {
    const next = new Set(get().readIds);
    get().notifications.forEach((n) => next.add(n.id));
    saveStoredReadIds(next);
    set({ readIds: next });
  },

  toggleOpen: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  setOpen: (open) => {
    set({ isOpen: open });
  },
}));
