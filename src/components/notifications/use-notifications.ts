'use client';

import { useEffect, useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchCalendarEvents, 
  fetchFinances, 
  fetchChores, 
  fetchShoppingLists,
  fetchPetLogs,
  fetchPets,
  fetchChoreGachaSpins,
  fetchProfile,
  type DbCalendarEvent,
  type DbFinance,
  type DbChore,
  type DbShoppingItem,
  type DbPetLog,
  type DbPet,
  type DbChoreGachaSpin
} from '@/lib/services/db';
import { useNotificationStore } from '@/features/shared/stores/use-notification-store';
import { useLanguage } from '@/lib/i18n/language-context';
import type { InAppNotification } from '@/types/notification';

export function useNotifications() {
  const { language } = useLanguage();
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const notifications = useNotificationStore((state) => state.notifications);
  const readIds = useNotificationStore((state) => state.readIds);
  const [loading, setLoading] = useState(true);

  const checkNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await fetchProfile(user.id);
      if (!profile?.household_id) return;

      const householdId = profile.household_id;

      // Fetch all required resources in parallel
      const [events, finances, chores, shoppingLists, petLogs, pets, gachaSpins] = await Promise.all([
        fetchCalendarEvents(householdId).catch(() => [] as DbCalendarEvent[]),
        fetchFinances(householdId).catch(() => [] as DbFinance[]),
        fetchChores(householdId).catch(() => [] as DbChore[]),
        fetchShoppingLists(householdId).catch(() => []),
        fetchPetLogs(householdId).catch(() => [] as DbPetLog[]),
        fetchPets(householdId).catch(() => [] as DbPet[]),
        fetchChoreGachaSpins(householdId).catch(() => [] as DbChoreGachaSpin[]),
      ]);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const newNotifications: InAppNotification[] = [];

      // 1. 📅 กิจกรรมวันนี้ (Calendar event วันนี้ที่ยังไม่ผ่าน)
      events.forEach((evt) => {
        if (!evt.start_time) return;
        const evtDate = evt.start_time.split('T')[0];
        if (evtDate === todayStr) {
          // Check if time has already passed
          const evtEndTime = evt.end_time ? new Date(evt.end_time) : new Date(evt.start_time);
          // If event has time and already finished before now, skip
          const isPast = evt.start_time.includes('T') && evtEndTime.getTime() < now.getTime() && (now.getTime() - evtEndTime.getTime() > 1000 * 60 * 30);
          
          if (!isPast) {
            const timeFormatted = evt.start_time.includes('T')
              ? new Date(evt.start_time).toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })
              : (language === 'th' ? 'ตลอดทั้งวัน' : 'All day');

            newNotifications.push({
              id: `cal-today-${evt.id}`,
              type: 'calendar_today',
              icon: '📅',
              title: language === 'th' ? 'กิจกรรมวันนี้' : "Today's Event",
              message: `${evt.title} (${timeFormatted})${evt.location ? ` @ ${evt.location}` : ''}`,
              link: '/calendar',
              badge: timeFormatted,
              category: 'calendar',
              created_at: evt.start_time,
            });
          }
        }
      });

      // 2. 📅 กิจกรรมพรุ่งนี้ (เตือนล่วงหน้า)
      events.forEach((evt) => {
        if (!evt.start_time) return;
        const evtDate = evt.start_time.split('T')[0];
        if (evtDate === tomorrowStr) {
          const timeFormatted = evt.start_time.includes('T')
            ? new Date(evt.start_time).toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })
            : (language === 'th' ? 'ตลอดทั้งวัน' : 'All day');

          newNotifications.push({
            id: `cal-tomorrow-${evt.id}`,
            type: 'calendar_tomorrow',
            icon: '📅',
            title: language === 'th' ? 'กิจกรรมพรุ่งนี้' : "Tomorrow's Event",
            message: `${evt.title} (${timeFormatted})`,
            link: '/calendar',
            badge: language === 'th' ? 'พรุ่งนี้' : 'Tomorrow',
            category: 'calendar',
            created_at: evt.start_time,
          });
        }
      });

      // 3. 💰 ยอดค้างชำระ (มี finance ที่ยังไม่ settle)
      const unreimbursedFinances = finances.filter((f) => !f.is_reimbursed);
      if (unreimbursedFinances.length > 0) {
        const totalPending = unreimbursedFinances.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        newNotifications.push({
          id: `fin-unsettled-summary`,
          type: 'finance_pending',
          icon: '💰',
          title: language === 'th' ? 'ยอดค้างชำระ' : 'Pending Expenses',
          message: language === 'th'
            ? `มียอดค่าใช้จ่ายที่ยังไม่ได้เคลียร์ ${unreimbursedFinances.length} รายการ (รวม ฿${totalPending.toLocaleString('th-TH')})`
            : `${unreimbursedFinances.length} pending expense(s) to settle (Total ฿${totalPending.toLocaleString()})`,
          link: '/finances',
          badge: `฿${totalPending.toLocaleString()}`,
          category: 'finance',
          created_at: unreimbursedFinances[0].date || todayStr,
          count: unreimbursedFinances.length,
        });
      }

      // 4. 🧾 สลิปใกล้หมดอายุ (สลิปเหลือ <= 2 วันก่อนถูกลบ)
      // Note: Slips expire after 7 days from upload
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

      finances.forEach((f) => {
        if (f.slip_url && f.slip_uploaded_at) {
          const uploadTime = new Date(f.slip_uploaded_at).getTime();
          const deleteTime = uploadTime + SEVEN_DAYS_MS;
          const timeLeftMs = deleteTime - now.getTime();

          // If remaining time is between 0 and 2 days (i.e. <= 2 days)
          if (timeLeftMs > 0 && timeLeftMs <= TWO_DAYS_MS) {
            const daysLeft = Math.max(1, Math.ceil(timeLeftMs / (1000 * 60 * 60 * 24)));
            newNotifications.push({
              id: `slip-expiring-${f.id}`,
              type: 'slip_expiring',
              icon: '🧾',
              title: language === 'th' ? 'สลิปใกล้หมดอายุ' : 'Slip Expiring Soon',
              message: language === 'th'
                ? `สลิปของ "${f.title}" จะถูกลบในอีก ${daysLeft} วัน (ประวัติการเงินยังคงอยู่)`
                : `Slip for "${f.title}" will be deleted in ${daysLeft} day(s) (Record preserved)`,
              link: '/finances',
              badge: `${daysLeft}d`,
              category: 'finance',
              created_at: f.slip_uploaded_at,
            });
          }
        }
      });

      // 5. 🛒 รายการซื้อของใหม่ หรือ มีของค้างซื้อ
      shoppingLists.forEach((l) => {
        const unpurchasedCount = l.items ? l.items.filter((i: any) => !i.is_purchased).length : 0;
        if (l.created_at) {
          const createdTime = new Date(l.created_at).getTime();
          const isRecent = now.getTime() - createdTime < 48 * 60 * 60 * 1000;
          if (isRecent && unpurchasedCount > 0) {
            newNotifications.push({
              id: `shopping-new-list-${l.id}`,
              type: 'shopping_new_list',
              icon: '🛒',
              title: language === 'th' ? 'มีลิสต์ซื้อของใหม่' : 'New Shopping List',
              message: language === 'th'
                ? `ลิสต์ "${l.title}" มีของที่ต้องซื้อ ${unpurchasedCount} รายการ`
                : `List "${l.title}" has ${unpurchasedCount} items to buy`,
              link: '/shopping',
              badge: language === 'th' ? 'ลิสต์ใหม่' : 'New',
              category: 'shopping',
              created_at: l.created_at,
            });
          }
        }
      });

      const allShoppingItems: DbShoppingItem[] = [];
      shoppingLists.forEach((l) => {
        if (l.items) {
          allShoppingItems.push(...l.items);
        }
      });
      const pendingItems = allShoppingItems.filter((i) => !i.is_purchased);
      if (pendingItems.length > 3) {
        newNotifications.push({
          id: `shopping-pending-summary`,
          type: 'shopping_pending',
          icon: '🛒',
          title: language === 'th' ? 'ของที่ยังไม่ได้ซื้อ' : 'Shopping Needed',
          message: language === 'th'
            ? `มีรายการของที่ยังไม่ได้ซื้อค้างอยู่ ${pendingItems.length} รายการ`
            : `${pendingItems.length} items waiting to be purchased`,
          link: '/shopping',
          badge: `${pendingItems.length}`,
          category: 'shopping',
          created_at: todayStr,
          count: pendingItems.length,
        });
      }

      // 6. 🐾 นัดหมายสัตว์เลี้ยง (แจ้งเตือนล่วงหน้า 3 วันสำหรับ ฉีดวัคซีน, อาบน้ำตัดขน, พบแพทย์)
      petLogs.forEach((pl) => {
        if (pl.is_done || !pl.scheduled_date) return;
        const petObj = pets.find((p) => p.id === pl.pet_id);
        const petName = petObj?.name || (language === 'th' ? 'สัตว์เลี้ยง' : 'Pet');

        // Date math
        const logDate = new Date(pl.scheduled_date);
        const diffTime = logDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 3) {
          const actionText =
            pl.log_type === 'vaccine'
              ? (language === 'th' ? 'ฉีดวัคซีน' : 'vaccination')
              : pl.log_type === 'grooming'
              ? (language === 'th' ? 'อาบน้ำตัดขน' : 'grooming')
              : (language === 'th' ? 'พบสัตวแพทย์ / ตรวจสุขภาพ' : 'vet checkup');

          const formattedDate = new Date(pl.scheduled_date).toLocaleDateString(
            language === 'th' ? 'th-TH' : 'en-US',
            { day: 'numeric', month: 'short' }
          );

          const daysLabel =
            diffDays === 0
              ? (language === 'th' ? 'วันนี้' : 'Today')
              : diffDays === 1
              ? (language === 'th' ? 'พรุ่งนี้' : 'Tomorrow')
              : (language === 'th' ? `อีก ${diffDays} วัน` : `In ${diffDays} days`);

          newNotifications.push({
            id: `pet-advance-${pl.id}`,
            type: 'pet_care_reminder',
            icon: '🐾',
            title: language === 'th' ? `นัดหมาย ${petName} (${daysLabel})` : `${petName} Appointment (${daysLabel})`,
            message: language === 'th'
              ? `อีก ${diffDays > 0 ? diffDays : 0} วันจะถึงวันที่ ${formattedDate}: ต้องพา${petName}ไป${actionText} (${pl.title}) 🐾`
              : `In ${diffDays} day(s) on ${formattedDate}: Bring ${petName} for ${actionText} (${pl.title}) 🐾`,
            link: '/pets',
            badge: daysLabel,
            category: 'pets',
            created_at: pl.scheduled_date,
          });
        }
      });

      // 7. 💰 มีค่าใช้จ่ายใหม่ที่เพิ่งเพิ่ม (< 24 ชม.)
      finances.forEach((f) => {
        if (!f.is_reimbursed && f.created_at) {
          const createdTime = new Date(f.created_at).getTime();
          const isRecent = now.getTime() - createdTime < 24 * 60 * 60 * 1000;
          if (isRecent) {
            newNotifications.push({
              id: `fin-new-${f.id}`,
              type: 'finance_new_expense',
              icon: '💰',
              title: language === 'th' ? 'มีค่าใช้จ่ายใหม่' : 'New Expense',
              message: language === 'th'
                ? `รายการ "${f.title}" ยอดเงิน ฿${Number(f.amount || 0).toLocaleString('th-TH')}`
                : `"${f.title}" amount ฿${Number(f.amount || 0).toLocaleString()}`,
              link: '/finances',
              badge: `฿${Number(f.amount || 0).toLocaleString()}`,
              category: 'finance',
              created_at: f.created_at,
            });
          }
        }
      });

      // 8. 🧹 งานบ้านค้างอยู่ (chores ที่เลย due_date แล้วและยังไม่เสร็จ)
      chores.forEach((c) => {
        if (!c.is_completed && c.due_date) {
          const dueDate = new Date(c.due_date);
          const dueDayStr = c.due_date.split('T')[0];
          if (dueDayStr < todayStr || (dueDayStr === todayStr && dueDate.getTime() < now.getTime())) {
            newNotifications.push({
              id: `chore-overdue-${c.id}`,
              type: 'chore_overdue',
              icon: '🧹',
              title: language === 'th' ? 'งานบ้านค้างอยู่' : 'Overdue Chore',
              message: language === 'th'
                ? `"${c.title}" เลยกำหนดแล้ว`
                : `"${c.title}" is overdue`,
              link: '/chores',
              badge: language === 'th' ? 'เลยกำหนด' : 'Overdue',
              category: 'chore',
              created_at: c.due_date,
            });
          }
        }
      });

      // 9. 🎁 สุ่มกล่องปริศนา (< 48 ชม.)
      gachaSpins.forEach((gs) => {
        if (gs.created_at) {
          const createdTime = new Date(gs.created_at).getTime();
          const isRecent = now.getTime() - createdTime < 48 * 60 * 60 * 1000;
          if (isRecent) {
            const userName = gs.user?.nickname || gs.user?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Homie');
            newNotifications.push({
              id: `gacha-spin-${gs.id}`,
              type: 'chore_gacha_spin',
              icon: '🎁',
              title: language === 'th' ? `กล่องสุ่มงานบ้าน (x${gs.multiplier})` : `Mystery Box (x${gs.multiplier})`,
              message: language === 'th'
                ? `${userName} สุ่มได้งานบ้าน "${gs.chore_title}" โบนัสคูณ x${gs.multiplier}! 🌟`
                : `${userName} got "${gs.chore_title}" with x${gs.multiplier} multiplier! 🌟`,
              link: '/rewards',
              badge: `x${gs.multiplier}`,
              category: 'chore',
              created_at: gs.created_at,
            });
          }
        }
      });

      setNotifications(newNotifications);
    } catch (err) {
      console.warn('Error evaluating notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [language, setNotifications]);

  useEffect(() => {
    checkNotifications();
    // Re-check periodically every 60 seconds
    const interval = setInterval(checkNotifications, 60000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return {
    notifications,
    unreadCount,
    loading,
    refresh: checkNotifications,
  };
}
