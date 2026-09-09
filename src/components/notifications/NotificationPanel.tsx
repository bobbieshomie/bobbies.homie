'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, 
  CheckCheck, 
  BellRing, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2,
  Smartphone 
} from 'lucide-react';
import { RiBearSmileFill } from '@remixicon/react';
import { useNotificationStore } from '@/features/shared/stores/use-notification-store';
import { useLanguage } from '@/lib/i18n/language-context';
import { requestFcmToken, type FcmTokenResult } from '@/lib/firebase/messaging';
import { isFirebaseConfigured } from '@/lib/firebase/client';
import { createClient } from '@/lib/supabase/client';
import type { InAppNotification } from '@/types/notification';

export function NotificationPanel() {
  const router = useRouter();
  const { language } = useLanguage();
  const isOpen = useNotificationStore((state) => state.isOpen);
  const setOpen = useNotificationStore((state) => state.setOpen);
  const notifications = useNotificationStore((state) => state.notifications);
  const readIds = useNotificationStore((state) => state.readIds);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [fcmLoading, setFcmLoading] = useState(false);
  const [fcmResult, setFcmResult] = useState<FcmTokenResult | null>(null);

  // Auto-detect if user already has an active FCM token
  useState(() => {
    async function checkExistingToken() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('fcm_token').eq('id', user.id).single();
          if (data?.fcm_token) {
            setFcmResult({ token: data.fcm_token, status: 'granted' });
          }
        }
      } catch {}
    }
    checkExistingToken();
  });

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread') {
      return !readIds.has(item.id);
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const handleItemClick = (item: InAppNotification) => {
    markAsRead(item.id);
    setOpen(false);
    router.push(item.link);
  };

  const handleEnablePush = async () => {
    setFcmLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const res = await requestFcmToken(user?.id);
      setFcmResult(res);
    } catch (err) {
      setFcmResult({ token: null, status: 'error', message: String(err) });
    } finally {
      setFcmLoading(false);
    }
  };

  return (
    <div 
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex justify-center items-start pt-14 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
    >
      <div 
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] max-h-[80vh] flex flex-col bg-[#FDFBF7] dark:bg-[#1A1816] rounded-3xl border border-[#D7CCC8]/70 dark:border-[#3E322A]/70 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300 cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#EFEBE9] dark:border-[#2D2622]">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8D6E63]/15 text-[#5D4037] dark:text-[#E6DFDA]">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#5D4037] dark:text-[#E6DFDA] font-outfit">
                {language === 'th' ? 'การแจ้งเตือน' : 'Notifications'}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#9E9087]">
                {unreadCount > 0 
                  ? (language === 'th' ? `ยังไม่อ่าน ${unreadCount} รายการ` : `${unreadCount} unread`)
                  : (language === 'th' ? 'อ่านครบหมดแล้ว' : 'All caught up')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title={language === 'th' ? 'อ่านทั้งหมด' : 'Mark all as read'}
                className="p-1.5 rounded-lg text-[#8D6E63] hover:text-[#5D4037] dark:text-[#9E9087] dark:hover:text-[#E6DFDA] hover:bg-[#F4EFEA] dark:hover:bg-[#2A2421] transition-colors text-xs flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">{language === 'th' ? 'อ่านหมด' : 'Read all'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full text-[#8D6E63] hover:text-[#5D4037] dark:text-[#9E9087] dark:hover:text-[#E6DFDA] hover:bg-[#F4EFEA] dark:hover:bg-[#2A2421] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Firebase Push Notification Banner */}
        <div className="px-4 py-2.5 bg-[#F8F5F0] dark:bg-[#231F1C] border-b border-[#EFEBE9] dark:border-[#2D2622]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Smartphone className="w-4 h-4 text-[#8D6E63] dark:text-[#BCAAA4] shrink-0" />
              <div className="truncate">
                <span className="text-[12px] font-medium text-[#5D4037] dark:text-[#E6DFDA] block leading-tight">
                  {language === 'th' ? 'Push Notification (FCM)' : 'Push Notifications (FCM)'}
                </span>
                <span className="text-[10px] text-[#8D6E63] dark:text-[#9E9087] block leading-tight truncate">
                  {!isFirebaseConfigured 
                    ? (language === 'th' ? 'ต้องระบุค่า Firebase ใน .env' : 'Firebase keys not configured')
                    : fcmResult?.status === 'granted'
                    ? (language === 'th' ? 'เปิดแจ้งเตือนบนเครื่องแล้ว' : 'Push notifications active')
                    : (language === 'th' ? 'รับการแจ้งเตือนแม้ไม่ได้เปิดแอป' : 'Get alerts even when app is closed')}
                </span>
              </div>
            </div>

            {fcmResult?.status === 'granted' ? (
              <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1B2E1D] dark:text-[#81C784] shrink-0">
                {language === 'th' ? '✓ เปิดแล้ว' : '✓ Active'}
              </span>
            ) : (
              <button
                type="button"
                disabled={fcmLoading}
                onClick={handleEnablePush}
                className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-[#5D4037] text-white hover:bg-[#4A332C] dark:bg-[#8D6E63] dark:hover:bg-[#9E7D72] active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                {fcmLoading ? '...' : (language === 'th' ? 'เปิดใช้งาน' : 'Enable')}
              </button>
            )}
          </div>

          {fcmResult && fcmResult.status !== 'granted' && (
            <div className="mt-1.5 text-[10px] text-[#C62828] dark:text-[#EF9A9A] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{fcmResult.message || 'Error configuring FCM'}</span>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center px-4 pt-2.5 pb-1 gap-2 border-b border-[#EFEBE9]/60 dark:border-[#2D2622]/60">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#5D4037] text-white dark:bg-[#DDD7D2] dark:text-[#141312]'
                : 'text-[#8D6E63] hover:bg-[#F4EFEA] dark:text-[#9E9087] dark:hover:bg-[#2A2421]'
            }`}
          >
            {language === 'th' ? 'ทั้งหมด' : 'All'} ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'unread'
                ? 'bg-[#5D4037] text-white dark:bg-[#DDD7D2] dark:text-[#141312]'
                : 'text-[#8D6E63] hover:bg-[#F4EFEA] dark:text-[#9E9087] dark:hover:bg-[#2A2421]'
            }`}
          >
            {language === 'th' ? 'ยังไม่อ่าน' : 'Unread'} ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[50vh]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F4EFEA] dark:bg-[#25201D] flex items-center justify-center mb-2 text-[#8D6E63] dark:text-[#9E9087]">
                <RiBearSmileFill className="w-6 h-6 fill-[#8D6E63] dark:fill-[#9E9087]" />
              </div>
              <p className="text-xs font-medium text-[#5D4037] dark:text-[#E6DFDA]">
                {language === 'th' ? 'ไม่มีการแจ้งเตือนในขณะนี้' : 'No notifications right now'}
              </p>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#9E9087] mt-0.5">
                {language === 'th' ? 'ทุกอย่างในบ้านเรียบร้อยดีแล้ว' : 'Everything in homie is up to date'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const isRead = readIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`group relative flex items-start gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isRead
                      ? 'bg-white/50 dark:bg-[#1E1B19]/50 border-[#EFEBE9]/60 dark:border-[#2D2622]/60 opacity-75 hover:opacity-100 hover:bg-white dark:hover:bg-[#24201D]'
                      : 'bg-white dark:bg-[#24201D] border-[#D7CCC8]/80 dark:border-[#3E322A] shadow-sm hover:border-[#8D6E63]'
                  }`}
                >
                  {/* Category Emoji Icon */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F4EFEA] dark:bg-[#2F2722] text-xl shrink-0 shadow-inner">
                    {item.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-[#5D4037] dark:text-[#E6DFDA] truncate font-outfit">
                          {item.title}
                        </span>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#E0533C] shrink-0" />
                        )}
                      </div>

                      {item.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8D6E63]/10 text-[#8D6E63] dark:bg-[#8D6E63]/25 dark:text-[#D7CCC8] shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-[12px] text-[#6D4C41] dark:text-[#C5BCB6] mt-0.5 leading-snug line-clamp-2 font-dm-sans">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between mt-1.5 pt-1 text-[10px] text-[#8D6E63] dark:text-[#9E9087]">
                      <span className="inline-flex items-center gap-0.5 text-[#8D6E63] dark:text-[#BCAAA4] group-hover:text-[#5D4037] dark:group-hover:text-white font-medium">
                        {language === 'th' ? 'ไปดูรายละเอียด' : 'View details'}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                      {isRead && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#2E7D32] dark:text-[#81C784]">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {language === 'th' ? 'อ่านแล้ว' : 'Read'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#F8F5F0] dark:bg-[#201C19] border-t border-[#EFEBE9] dark:border-[#2D2622] text-center">
          <p className="text-[11px] text-[#8D6E63] dark:text-[#9E9087]">
            {language === 'th' ? 'แตะการแจ้งเตือนเพื่อเปิดหน้าจัดการ' : 'Tap any notification to view details'}
          </p>
        </div>
      </div>
    </div>
  );
}
