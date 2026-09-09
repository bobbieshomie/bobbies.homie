'use client';

import { useEffect, useState } from 'react';
import { setupForegroundMessageListener } from '@/lib/firebase/messaging';
import { Bell, X } from 'lucide-react';

export function ForegroundNotificationListener() {
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function init() {
      unsubscribe = await setupForegroundMessageListener((payload) => {
        const title = payload.notification?.title || payload.data?.title || 'Bobbies Homie';
        const body = payload.notification?.body || payload.data?.body || 'คุณมีการแจ้งเตือนใหม่';

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch {}
        }

        setToast({ title, body });
      });
    }

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-in slide-in-from-top-4 duration-300">
      <div className="w-full max-w-[370px] pointer-events-auto bg-[#FDFBF7] dark:bg-[#25201D] border border-[#D7CCC8] dark:border-[#3E322A] shadow-2xl rounded-2xl p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#5D4037] text-white flex items-center justify-center shrink-0 shadow-sm">
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
            {toast.title}
          </h4>
          <p className="text-xs text-[#8D6E63] dark:text-[#BCAAA4] mt-0.5 line-clamp-2">
            {toast.body}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="text-[#8D6E63] hover:text-[#5D4037] dark:text-[#BCAAA4] p-1 rounded-full cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
