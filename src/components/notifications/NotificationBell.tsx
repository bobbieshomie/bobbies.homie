'use client';

import { Bell } from 'lucide-react';
import { useNotifications } from './use-notifications';
import { useNotificationStore } from '@/features/shared/stores/use-notification-store';

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const toggleOpen = useNotificationStore((state) => state.toggleOpen);
  const isOpen = useNotificationStore((state) => state.isOpen);

  return (
    <button
      type="button"
      onClick={toggleOpen}
      aria-label="Notifications"
      className="relative flex items-center justify-center w-9 h-9 rounded-full bg-[#F4EFEA] dark:bg-[#2A2421] border border-[#D7CCC8]/60 dark:border-[#4A3B32]/60 text-[#5D4037] dark:text-[#E6DFDA] hover:bg-[#EFE9E3] dark:hover:bg-[#342C28] transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
    >
      <Bell className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'scale-110' : ''}`} />
      
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#E0533C] rounded-full ring-2 ring-[#FDFBF7] dark:ring-[#141312] animate-in zoom-in duration-200">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
