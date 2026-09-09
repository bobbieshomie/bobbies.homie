'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Edit3,
  Gift,
  Clock,
  CheckCircle2,
  CheckSquare,
  History,
  User,
  Users,
  Loader2,
  Calendar as CalendarIcon,
  Sparkles,
  ArrowRight,
  Filter,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchChores,
  createChore,
  updateChore,
  deleteChore,
  completeChoreWithAssignees,
  fetchChorePointLogs,
  fetchHouseholdMembers,
  fetchMyActiveGachaSpin,
  type DbChore,
  type DbChorePointLog,
  type DbProfile,
  type DbChoreGachaSpin,
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type ActiveTab = 'tasks' | 'logs';
type ChoreFilter = 'all' | 'today' | 'pending' | 'done';

export interface ChoreSchedule {
  isDaily: boolean;
  intervalDays: number;
  time: string;
}

export function parseChoreSchedule(chore: DbChore): ChoreSchedule {
  if (chore.description) {
    try {
      const parsed = JSON.parse(chore.description);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          isDaily: Boolean(parsed.isDaily ?? (chore.frequency === 'daily')),
          intervalDays: Math.max(1, Number(parsed.intervalDays) || (chore.frequency === 'weekly' ? 7 : 3)),
          time: typeof parsed.time === 'string' ? parsed.time : '',
        };
      }
    } catch {
      // Not JSON, continue to fallback
    }
  }

  return {
    isDaily: chore.frequency === 'daily',
    intervalDays: chore.frequency === 'weekly' ? 7 : chore.frequency === 'monthly' ? 30 : 3,
    time: chore.due_date && chore.due_date.includes('T') ? chore.due_date.split('T')[1]?.slice(0, 5) : '',
  };
}

export default function ChoresPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const profile = useAppStore((state) => state.profile);
  const setStoreChores = useAppStore((state) => state.setChores);

  // Core Data
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [myPoints, setMyPoints] = useState<number>(0);

  const [chores, setChores] = useState<DbChore[]>([]);
  const [pointLogs, setPointLogs] = useState<DbChorePointLog[]>([]);
  const [activeGachaSpin, setActiveGachaSpin] = useState<DbChoreGachaSpin | null>(null);

  // Navigation & Filter
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [choreFilter, setChoreFilter] = useState<ChoreFilter>('all');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals for Create / Edit Chore
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<DbChore | null>(null);
  const [choreTitle, setChoreTitle] = useState('');
  const [choreIsDaily, setChoreIsDaily] = useState(true);
  const [choreIntervalDays, setChoreIntervalDays] = useState(3);
  const [choreTime, setChoreTime] = useState('');
  const [chorePoints, setChorePoints] = useState(10);
  const [savingChore, setSavingChore] = useState(false);

  // Modal for Who Completed The Chore
  const [completingChore, setCompletingChore] = useState<DbChore | null>(null);
  const [completingLoading, setCompletingLoading] = useState(false);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    description?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    onConfirm: () => {},
  });

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Load all chores and chore logs, auto-reset daily/recurring chores if due
  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userProfile?.household_id) {
        const hId = userProfile.household_id;
        setHouseholdId(hId);
        setMyPoints(userProfile.chore_points || 0);

        const [choresRes, pointLogsRes, membersRes, activeSpinRes] = await Promise.all([
          fetchChores(hId),
          fetchChorePointLogs(hId),
          fetchHouseholdMembers(hId),
          fetchMyActiveGachaSpin(user.id),
        ]);

        // ========================================================
        // AUTO RESET LOGIC (ทุกวันขึ้นวันใหม่จะรีเซ็ต / N วันจะมาทุก N วัน)
        // ========================================================
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const resetIds: string[] = [];
        const processedChores = choresRes.map((chore) => {
          if (!chore.is_completed || !chore.completed_at) return chore;

          const schedule = parseChoreSchedule(chore);
          const completedDate = new Date(chore.completed_at);
          const completedDayStr = completedDate.toLocaleDateString('en-CA');
          const compMidnight = new Date(
            completedDate.getFullYear(),
            completedDate.getMonth(),
            completedDate.getDate()
          ).getTime();
          const elapsedDays = Math.floor((todayMidnight - compMidnight) / (1000 * 60 * 60 * 24));

          let shouldReset = false;
          if (schedule.isDaily) {
            // New day arrived -> auto reset
            if (completedDayStr < todayStr) {
              shouldReset = true;
            }
          } else {
            // N-day recurring chore -> reset after intervalDays have passed
            if (elapsedDays >= schedule.intervalDays) {
              shouldReset = true;
            }
          }

          if (shouldReset) {
            resetIds.push(chore.id);
            return {
              ...chore,
              is_completed: false,
              completed_at: null,
              assigned_to: null,
            };
          }

          return chore;
        });

        // Asynchronously update reset status in Supabase
        if (resetIds.length > 0) {
          Promise.all(
            resetIds.map((id) =>
              updateChore(id, {
                is_completed: false,
                completed_at: null,
                assigned_to: null,
              }).catch((e) => console.error('Failed to auto-reset chore:', e))
            )
          ).catch(() => {});
        }

        setChores(processedChores);
        setPointLogs(pointLogsRes);
        setMembers(membersRes);
        setActiveGachaSpin(activeSpinRes);

        setStoreChores(
          processedChores.map((c) => ({
            id: c.id,
            title: c.title,
            frequency: (c.frequency as any) || 'daily',
            assignedTo: c.assigned_to || 'All',
            points: c.points || 10,
            isCompleted: c.is_completed,
            dueDate: c.due_date || undefined,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load chores data:', err);
    } finally {
      setLoading(false);
    }
  }, [setStoreChores]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Current user member
  const currentMember = useMemo(() => {
    return members.find((m) => m.id === currentUserId);
  }, [members, currentUserId]);

  // Filtered Chores
  const filteredChores = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');

    return chores.filter((chore) => {
      if (choreFilter === 'pending') return !chore.is_completed;
      if (choreFilter === 'done') return chore.is_completed;
      if (choreFilter === 'today') {
        const schedule = parseChoreSchedule(chore);
        // Daily chores always show in today's tab
        if (schedule.isDaily) return true;
        // Chores completed today show in today's tab
        if (chore.completed_at && chore.completed_at.startsWith(todayStr)) return true;
        // Non-completed chores due today
        if (chore.due_date && chore.due_date.startsWith(todayStr)) return true;
        return !chore.is_completed;
      }
      return true;
    });
  }, [chores, choreFilter]);

  // Chore Statistics
  const choreStats = useMemo(() => {
    const total = chores.length;
    const completed = chores.filter((c) => c.is_completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [chores]);

  // Separate Chore Completion Log
  const choreLogs = useMemo(() => {
    return pointLogs.filter(
      (log) => log.type === 'chore_complete' || log.points_delta > 0
    );
  }, [pointLogs]);

  // Handle Clicking Chore Checkbox
  const handleChoreCheckboxClick = (chore: DbChore) => {
    if (chore.is_completed) {
      // Uncompleting an already finished chore -> Ask confirmation
      setConfirmDialog({
        isOpen: true,
        title: language === 'th' ? 'ยกเลิกการทำงานบ้าน?' : 'Uncomplete Chore?',
        description:
          language === 'th'
            ? `ต้องการยกเลิก "${chore.title}" ใช่หรือไม่? คะแนนจะถูกหักคืน`
            : `Do you want to unmark "${chore.title}"? Points will be deducted.`,
        onConfirm: async () => {
          try {
            // Optimistic update
            setChores((prev) =>
              prev.map((c) =>
                c.id === chore.id
                  ? {
                      ...c,
                      is_completed: false,
                      completed_at: null,
                      assigned_to: null,
                    }
                  : c
              )
            );

            const res = await completeChoreWithAssignees(chore.id, false);
            if (res.success) {
              setMyPoints(res.new_balance);
              showToast(
                language === 'th'
                  ? 'ยกเลิกการทำงานบ้านแล้ว'
                  : 'Chore uncompleted'
              );
              if (householdId) {
                fetchChorePointLogs(householdId).then(setPointLogs).catch(() => {});
                fetchHouseholdMembers(householdId).then(setMembers).catch(() => {});
              }
            }
          } catch (err) {
            console.error('Failed to uncomplete chore:', err);
            loadData();
          }
        },
      });
    } else {
      // Incomplete chore -> Open completion selector modal
      setCompletingChore(chore);
    }
  };

  // Confirm Completion with Specific Member(s) or All
  const handleConfirmComplete = async (chore: DbChore, assigneeIds: string[]) => {
    if (!householdId) return;
    const isAll = assigneeIds.length > 1;
    const selectedMember = !isAll ? members.find((m) => m.id === assigneeIds[0]) : null;
    const personLabel = isAll
      ? language === 'th'
        ? 'ทุกคน'
        : 'Everyone'
      : selectedMember?.nickname || selectedMember?.full_name || 'Homie';

    try {
      setCompletingLoading(true);
      setCompletingChore(null);

      // Optimistic update
      setChores((prev) =>
        prev.map((c) =>
          c.id === chore.id
            ? {
                ...c,
                is_completed: true,
                completed_at: new Date().toISOString(),
                assigned_to: isAll ? null : assigneeIds[0],
              }
            : c
        )
      );

      const res = await completeChoreWithAssignees(chore.id, true, assigneeIds);

      if (res.success) {
        setMyPoints(res.new_balance);
        showToast(
          isAll
            ? language === 'th'
              ? `🎉 ช่วยกันทำทุกคน! (+${chore.points || 10} pt ให้ทุกคน)`
              : `🎉 Everyone helped! (+${chore.points || 10} pt to all)`
            : language === 'th'
            ? `🎉 ${personLabel} ทำเสร็จแล้ว (+${res.points_delta} pt)`
            : `🎉 ${personLabel} completed (+${res.points_delta} pt)`
        );

        // Broadcast push notification to partner
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: '🧹 Bobbies Homie',
            body:
              isAll
                ? language === 'th'
                  ? `ทุกคนช่วยกันทำงานบ้าน '${chore.title}' เสร็จแล้ว! ✨`
                  : `Everyone helped complete '${chore.title}'! ✨`
                : language === 'th'
                ? `${personLabel} ทำงานบ้าน '${chore.title}' เสร็จแล้ว! ✨`
                : `${personLabel} completed '${chore.title}'! ✨`,
            link: '/chores',
          }),
        }).catch(() => {});

        // Refresh point logs and members in background
        fetchChorePointLogs(householdId).then(setPointLogs).catch(() => {});
        fetchHouseholdMembers(householdId).then(setMembers).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to complete chore:', err);
      loadData();
    } finally {
      setCompletingLoading(false);
    }
  };

  // Open Create Chore Modal
  const openCreateChoreModal = () => {
    setEditingChore(null);
    setChoreTitle('');
    setChoreIsDaily(true);
    setChoreIntervalDays(3);
    setChoreTime('');
    setChorePoints(10);
    setIsChoreModalOpen(true);
  };

  // Open Edit Chore Modal
  const openEditChoreModal = (c: DbChore) => {
    setEditingChore(c);
    setChoreTitle(c.title);
    const sched = parseChoreSchedule(c);
    setChoreIsDaily(sched.isDaily);
    setChoreIntervalDays(sched.intervalDays);
    setChoreTime(sched.time);
    setChorePoints(c.points || 10);
    setIsChoreModalOpen(true);
  };

  // Handle Save Chore (No assignedTo lock, store schedule JSON in description)
  const handleSaveChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !currentUserId || !choreTitle.trim()) return;

    try {
      setSavingChore(true);

      const scheduleData: ChoreSchedule = {
        isDaily: choreIsDaily,
        intervalDays: choreIsDaily ? 1 : Math.max(1, Number(choreIntervalDays) || 3),
        time: choreTime.trim(),
      };
      const descriptionJson = JSON.stringify(scheduleData);

      const pgFrequency = choreIsDaily
        ? 'daily'
        : choreIntervalDays === 7
        ? 'weekly'
        : choreIntervalDays === 14
        ? 'biweekly'
        : choreIntervalDays === 30
        ? 'monthly'
        : 'once';

      const todayStr = new Date().toLocaleDateString('en-CA');
      const dueDate = choreTime.trim() ? `${todayStr}T${choreTime.trim()}:00` : null;

      if (!editingChore) {
        await createChore(householdId, currentUserId, {
          title: choreTitle.trim(),
          description: descriptionJson,
          assigned_to: null,
          frequency: pgFrequency,
          points: chorePoints,
          due_date: dueDate,
        });
        showToast(language === 'th' ? 'เพิ่มงานบ้านสำเร็จ' : 'Chore added');
      } else {
        await updateChore(editingChore.id, {
          title: choreTitle.trim(),
          description: descriptionJson,
          assigned_to: editingChore.assigned_to,
          frequency: pgFrequency,
          points: chorePoints,
          due_date: dueDate,
        });
        showToast(language === 'th' ? 'แก้ไขงานบ้านสำเร็จ' : 'Chore updated');
      }

      setIsChoreModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to save chore');
    } finally {
      setSavingChore(false);
    }
  };

  // Handle Delete Chore with Confirmation
  const handleDeleteChore = (chore: DbChore) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'th' ? 'ยืนยันการลบงานบ้าน' : 'Delete Chore?',
      description:
        language === 'th'
          ? `ต้องการลบงานบ้าน "${chore.title}" ใช่หรือไม่?`
          : `Are you sure you want to delete "${chore.title}"?`,
      onConfirm: async () => {
        try {
          await deleteChore(chore.id);
          showToast(language === 'th' ? 'ลบงานบ้านเรียบร้อย' : 'Chore deleted');
          await loadData();
        } catch (err: any) {
          alert(err?.message || 'Failed to delete chore');
        }
      },
    });
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-32 pt-4 transition-colors duration-200 font-dm-sans">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#5D4037] text-white px-4 py-2.5 rounded-full shadow-lg text-[13px] font-semibold flex items-center gap-2 animate-bounce font-dm-sans">
            <CheckCircle2 className="w-4 h-4 text-[#81C784]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="px-6 mb-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link
                href="/dashboard"
                className="w-9 h-9 rounded-[14px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] hover:opacity-80 transition-all shrink-0"
                aria-label="Back to dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>

              <h1 className="font-outfit font-bold text-[22px] sm:text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2] flex items-center gap-2 truncate">
                <CheckSquare className="w-5 h-5 text-[#2E7D32] shrink-0" />
                <span className="truncate">{language === 'th' ? 'งานบ้าน' : 'Chores'}</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Link to Rewards Shop */}
              <Link
                href="/rewards"
                className="font-dm-sans px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-80 transition-colors shadow-2xs"
              >
                <Gift className="w-3.5 h-3.5 text-[#E0533C]" />
                <span>{language === 'th' ? 'ร้านค้า' : 'Shop'}</span>
              </Link>

              <NotificationBell />
            </div>
          </div>

          <p className="font-dm-sans text-[12.5px] leading-normal text-[#8D6E63] dark:text-[#948D87] pl-0.5">
            {language === 'th' ? 'ช่วยกันดูแลบ้านให้สะอาดน่าอยู่' : 'Keeping our home cozy and clean'}
          </p>
        </div>

        {/* ======================================================== */}
        {/* CHORES PROGRESS CARD                                     */}
        {/* ======================================================== */}
        <div className="px-6 mb-3">
          <div className="p-4 bg-gradient-to-br from-[#FFFDF9] to-[#F7F3ED] dark:from-[#23201D] dark:to-[#1B1917] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.05)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-dm-sans text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87] uppercase tracking-wide">
                  {t.dashboard.todayChores}
                </span>
                <div className="font-outfit text-[20px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mt-0.5">
                  {choreStats.completed} / {choreStats.total} {t.dashboard.choresDone}
                </div>
              </div>

              {/* Progress Percentage Badge */}
              <div className="flex items-center gap-2">
                <span className="font-outfit text-[14px] font-bold text-[#2E7D32] dark:text-[#81C784] bg-[#E8F5E9] dark:bg-[#1B5E20]/30 px-2.5 py-1 rounded-[10px]">
                  {choreStats.percent}%
                </span>
              </div>
            </div>

            {/* Progress Bar Line */}
            <div className="w-full h-2 bg-[#EADFD5] dark:bg-[#2E2A27] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#2E7D32] transition-all duration-300 rounded-full"
                style={{ width: `${choreStats.percent}%` }}
              />
            </div>

            {/* Points Footnote */}
            <div className="mt-3 pt-2.5 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] flex items-center justify-between text-[11px] text-[#8D6E63] dark:text-[#948D87] font-dm-sans">
              <span>
                {language === 'th' ? 'คะแนนสะสมของคุณ:' : 'Your Points:'}{' '}
                <span className="font-outfit font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {myPoints} pt
                </span>
              </span>
              <Link
                href="/rewards"
                className="inline-flex items-center gap-0.5 text-[#5D4037] dark:text-[#DDD7D2] hover:underline font-semibold"
              >
                <span>{language === 'th' ? 'แลกของรางวัล' : 'Redeem rewards'}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TABS: งานบ้าน (TASKS) vs ประวัติงานบ้าน (CHORE LOG)         */}
        {/* ======================================================== */}
        <div className="px-6 py-1 w-full mb-2">
          <div className="flex items-center gap-1.5 p-1 bg-[#F4EFEA] dark:bg-[#23201D] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[18px]">
            {/* Tab 1: งานบ้าน */}
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer font-dm-sans ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'รายการงานบ้าน' : 'Tasks'}</span>
              {choreStats.completed < choreStats.total && (
                <span className="font-outfit px-1.5 py-0.2 rounded-full bg-[#8D6E63]/15 text-[10px] font-bold">
                  {choreStats.total - choreStats.completed}
                </span>
              )}
            </button>

            {/* Tab 2: ประวัติงานบ้าน */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer font-dm-sans ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ประวัติงานบ้าน' : 'Chore History'}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: CHORE TASKS                                       */}
        {/* ======================================================== */}
        {activeTab === 'tasks' && (
          <div className="px-6 pt-2 space-y-3">
            {/* Filter Pills and Add Chore Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 font-dm-sans">
                {(['all', 'today', 'pending', 'done'] as ChoreFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setChoreFilter(f)}
                    className={`px-3 py-1.5 rounded-[12px] text-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      choreFilter === f
                        ? 'bg-[#5D4037] text-white dark:bg-[#DDD7D2] dark:text-[#1A1816]'
                        : 'bg-[#F4EFEA] dark:bg-[#24211E] text-[#8D6E63] dark:text-[#948D87] border border-[#D7CCC8] dark:border-[#2E2A27]'
                    }`}
                  >
                    {f === 'all' && t.chores.allTab}
                    {f === 'today' && t.chores.todayTab}
                    {f === 'pending' && t.chores.pendingTab}
                    {f === 'done' && t.chores.doneTab}
                  </button>
                ))}
              </div>

              <button
                onClick={openCreateChoreModal}
                className="shrink-0 px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 cursor-pointer font-dm-sans"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.chores.addChore}</span>
              </button>
            </div>

            {/* Chores List */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-[#8D6E63]">
                <Loader2 className="w-6 h-6 animate-spin text-[#5D4037]" />
              </div>
            ) : filteredChores.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6 font-dm-sans">
                <CheckSquare className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.noChores}
                </p>
                <button
                  onClick={openCreateChoreModal}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[#2E7D32] hover:underline cursor-pointer"
                >
                  + {t.chores.addChore}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredChores.map((chore) => {
                  const schedule = parseChoreSchedule(chore);

                  // Calculate days left for N-day chores
                  let daysLeft = 0;
                  if (chore.is_completed && !schedule.isDaily && chore.completed_at) {
                    const compDate = new Date(chore.completed_at);
                    const now = new Date();
                    const compMid = new Date(compDate.getFullYear(), compDate.getMonth(), compDate.getDate()).getTime();
                    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const elapsed = Math.floor((todayMid - compMid) / (1000 * 60 * 60 * 24));
                    daysLeft = Math.max(0, schedule.intervalDays - elapsed);
                  }

                  const assignedMember = chore.assigned_to
                    ? members.find((m) => m.id === chore.assigned_to)
                    : null;

                  return (
                    <SwipeableRow
                      key={chore.id}
                      onEdit={() => openEditChoreModal(chore)}
                      onDelete={() => handleDeleteChore(chore)}
                      className="rounded-[18px]"
                    >
                      <div className="w-full p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 transition-colors">
                        {/* Left: Checkbox & Chore Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => handleChoreCheckboxClick(chore)}
                            aria-label={chore.is_completed ? 'Mark undone' : 'Mark done'}
                            className={`w-7 h-7 rounded-[10px] flex items-center justify-center border-2 transition-all shrink-0 cursor-pointer ${
                              chore.is_completed
                                ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-xs'
                                : 'border-[#8D6E63]/40 hover:border-[#5D4037] dark:hover:border-[#DDD7D2]'
                            }`}
                          >
                            {chore.is_completed && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-dm-sans text-[14px] font-bold block truncate transition-all ${
                                  chore.is_completed
                                    ? 'line-through text-[#8D6E63]/60 dark:text-[#948D87]/60'
                                    : 'text-[#5D4037] dark:text-[#DDD7D2]'
                                }`}
                              >
                                {chore.title}
                              </span>

                              {/* Time badge if specified */}
                              {schedule.time && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#8D6E63]/10 text-[#8D6E63] dark:text-[#948D87] shrink-0">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{schedule.time} น.</span>
                                </span>
                              )}
                            </div>

                            {/* Frequency and status info */}
                            <div className="font-dm-sans flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              {/* Frequency badge */}
                              <span className="font-semibold text-[#2E7D32] dark:text-[#81C784]">
                                {schedule.isDaily
                                  ? language === 'th'
                                    ? 'ทำทุกวัน'
                                    : 'Daily'
                                  : language === 'th'
                                  ? `ทุกๆ ${schedule.intervalDays} วัน`
                                  : `Every ${schedule.intervalDays} days`}
                              </span>

                              {/* Completion info */}
                              {chore.is_completed ? (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                                    <CheckCircle2 className="w-3 h-3 text-[#2E7D32]" />
                                    <span>
                                      {assignedMember
                                        ? `${language === 'th' ? 'ทำโดย' : 'By'}: ${
                                            assignedMember.nickname || assignedMember.full_name
                                          }`
                                        : language === 'th'
                                        ? 'ช่วยกันทำทุกคน'
                                        : 'All members'}
                                    </span>
                                  </span>

                                  {/* Recurrence Countdown for N-day chores */}
                                  {!schedule.isDaily && daysLeft > 0 && (
                                    <span className="text-[10px] text-[#8D6E63]/80 dark:text-[#948D87]/80">
                                      {language === 'th'
                                        ? `(มาใหม่อีกใน ${daysLeft} วัน)`
                                        : `(repeats in ${daysLeft}d)`}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span>•</span>
                                  <span className="text-[#8D6E63]/70 dark:text-[#948D87]/70">
                                    {language === 'th' ? 'พร้อมทำ' : 'Ready'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Points Badge */}
                        <div className="shrink-0 text-right">
                          <span className="font-outfit text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] bg-[#F4EFEA] dark:bg-[#282421] px-2.5 py-1 rounded-[8px]">
                            {chore.points || 10} pt
                          </span>
                        </div>
                      </div>
                    </SwipeableRow>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CHORE COMPLETION LOG (งานบ้าน, วันที่, คะแนน)       */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="px-6 pt-2 space-y-3 font-dm-sans">
            <div>
              <h2 className="font-outfit text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'ประวัติการทำงานบ้าน' : 'Chore Completion Log'}
              </h2>
              <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th'
                  ? 'รายการงานบ้านที่ทำเสร็จแล้ว วันที่ และคะแนนที่ได้รับ'
                  : 'Completed chores, date completed, and points earned'}
              </p>
            </div>

            {choreLogs.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <History className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="font-dm-sans text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th'
                    ? 'ยังไม่มีประวัติการทำงานบ้าน'
                    : 'No chore completion history yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {choreLogs.map((log) => {
                  const logUserName =
                    log.user?.nickname ||
                    log.user?.full_name ||
                    (log.user_id === currentUserId
                      ? language === 'th'
                        ? 'ฉัน'
                        : 'Me'
                      : 'เพื่อนร่วมบ้าน');

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      {/* Left: Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-dm-sans text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87]">
                            {logUserName}
                          </span>
                          <span className="font-dm-sans text-[10px] text-[#8D6E63]/60 dark:text-[#948D87]/60">
                            •{' '}
                            {log.created_at
                              ? new Date(log.created_at).toLocaleDateString(
                                  language === 'th' ? 'th-TH' : 'en-US',
                                  {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )
                              : ''}
                          </span>
                        </div>

                        <h4 className="font-dm-sans text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                          {log.title}
                        </h4>
                      </div>

                      {/* Right: Points earned */}
                      <div className="text-right shrink-0">
                        <span className="font-outfit font-bold text-[15px] text-[#2E7D32] dark:text-[#81C784]">
                          +{log.points_delta} pt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: CREATE / EDIT CHORE                               */}
        {/* ======================================================== */}
        {isChoreModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-dm-sans animate-fade-in"
            onClick={() => setIsChoreModalOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between">
                <h3 className="font-outfit text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {editingChore ? t.chores.editChore : t.chores.addChore}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsChoreModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveChore} className="p-6 space-y-4">
                {/* Chore Title */}
                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1 font-dm-sans">
                    {language === 'th' ? 'ชื่องานบ้าน' : 'Chore Title'}
                  </label>
                  <input
                    type="text"
                    required
                    value={choreTitle}
                    onChange={(e) => setChoreTitle(e.target.value)}
                    placeholder={
                      language === 'th' ? 'เช่น ล้างจาน, ถูห้องนอน, ทิ้งขยะ' : 'e.g. Wash dishes, Mop floor'
                    }
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] font-dm-sans text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                {/* Frequency: Daily Checkbox vs Interval Days */}
                <div className="space-y-2">
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] font-dm-sans">
                    {language === 'th' ? 'ความถี่ของงานบ้าน' : 'Frequency'}
                  </label>

                  {/* Daily Checkbox Card */}
                  <label className="flex items-center gap-2.5 p-3 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] cursor-pointer hover:border-[#5D4037] transition-all">
                    <input
                      type="checkbox"
                      checked={choreIsDaily}
                      onChange={(e) => setChoreIsDaily(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2E7D32] accent-[#2E7D32] focus:ring-0 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] block">
                        {language === 'th' ? 'ทำทุกวัน' : 'Every Day (Daily)'}
                      </span>
                      <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                        {language === 'th'
                          ? 'เมื่อขึ้นวันใหม่ระบบจะรีเซ็ตให้อัตโนมัติ'
                          : 'Resets automatically every new day'}
                      </span>
                    </div>
                  </label>

                  {/* If NOT daily: Show Interval Days Number Input */}
                  {!choreIsDaily && (
                    <div className="p-3 rounded-[14px] bg-[#FAF6F0] dark:bg-[#25221F] border border-[#D7CCC8]/80 dark:border-[#38332E] animate-fade-in space-y-1">
                      <label className="block text-[11.5px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                        {language === 'th' ? 'ทำซ้ำทุกๆ (วัน)' : 'Repeat every (days)'}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87]">
                          {language === 'th' ? 'ทุกๆ' : 'Every'}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={choreIntervalDays}
                          onChange={(e) =>
                            setChoreIntervalDays(Math.max(1, Number(e.target.value)))
                          }
                          className="w-20 px-3 py-1.5 rounded-[10px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[14px] text-center font-outfit font-bold text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                        />
                        <span className="text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87]">
                          {language === 'th'
                            ? 'วัน (เช่น 3 วัน คืองานจะมาทุก 3 วัน)'
                            : 'days (repeats every N days)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Time Input */}
                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1 font-dm-sans">
                    {language === 'th' ? 'เวลาที่ต้องทำ (ไม่ระบุก็ได้)' : 'Time (Optional)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Clock className="w-4 h-4 text-[#8D6E63] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={choreTime}
                        onChange={(e) => setChoreTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] font-dm-sans text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                      />
                    </div>
                    {choreTime && (
                      <button
                        type="button"
                        onClick={() => setChoreTime('')}
                        className="px-3 py-2.5 rounded-[12px] text-[11px] font-bold text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#3D3835] cursor-pointer"
                      >
                        {language === 'th' ? 'ล้าง' : 'Clear'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1 font-dm-sans">
                    {language === 'th' ? 'คะแนนที่ได้รับเมื่อทำเสร็จ (pt)' : 'Points on completion (pt)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={chorePoints}
                    onChange={(e) => setChorePoints(Number(e.target.value))}
                    placeholder="10"
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] font-outfit font-bold text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChoreModalOpen(false)}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] text-[13px] font-bold cursor-pointer font-dm-sans"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingChore}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50 font-dm-sans"
                  >
                    {savingChore ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>{t.common.save}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: CHOOSE WHO COMPLETED THE CHORE (เวลากดว่าทำแล้ว)     */}
        {/* ======================================================== */}
        {completingChore && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 font-dm-sans animate-fade-in"
            onClick={() => setCompletingChore(null)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-t-[28px] sm:rounded-[28px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-2xl overflow-hidden animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 text-center border-b border-[#D7CCC8]/50 dark:border-[#2E2A27] relative bg-gradient-to-b from-[#FAF4EC] to-[#FDFBF7] dark:from-[#26221E] dark:to-[#201D1A]">
                <button
                  type="button"
                  onClick={() => setCompletingChore(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] dark:bg-[#1B5E20]/30 text-[#2E7D32] dark:text-[#81C784] flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-outfit text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'ใครเป็นคนทำงานนี้?' : 'Who completed this chore?'}
                </h3>
                <p className="font-dm-sans text-[12.5px] text-[#8D6E63] dark:text-[#948D87] mt-1 font-medium flex items-center justify-center gap-1.5">
                  <span className="truncate max-w-[200px] text-[#5D4037] dark:text-[#DDD7D2] font-semibold">
                    {completingChore.title}
                  </span>
                  <span className="bg-[#2E7D32]/10 text-[#2E7D32] dark:text-[#81C784] px-2 py-0.5 rounded-full text-[11px] font-bold">
                    +{completingChore.points || 10} pt
                  </span>
                </p>
              </div>

              {/* Member Selection List */}
              <div className="p-5 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8D6E63] dark:text-[#948D87] px-1">
                  {language === 'th' ? 'เลือกผู้รับคะแนน' : 'Select who receives points'}
                </p>

                {/* Individual Members */}
                <div className="space-y-2">
                  {members.map((m) => {
                    const isMe = m.id === currentUserId;
                    return (
                      <button
                        key={m.id}
                        disabled={completingLoading}
                        onClick={() => handleConfirmComplete(completingChore, [m.id])}
                        className="w-full p-3 rounded-[16px] bg-white dark:bg-[#282421] border border-[#D7CCC8]/80 dark:border-[#38332E] hover:border-[#2E7D32] dark:hover:border-[#81C784] hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer group text-left disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#EADFD5] dark:bg-[#38332E] overflow-hidden flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] font-bold text-[14px] shrink-0 border border-[#D7CCC8]/60">
                            {m.avatar_url ? (
                              <img
                                src={m.avatar_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (m.nickname || m.full_name || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-dm-sans text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                                {m.nickname || m.full_name}
                              </span>
                              {isMe && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#8D6E63]/15 text-[#8D6E63] dark:text-[#948D87]">
                                  {language === 'th' ? 'ฉัน' : 'Me'}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              {m.chore_points || 0} pt
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 px-2.5 py-1 rounded-[10px] bg-[#E8F5E9] dark:bg-[#1B5E20]/30 text-[#2E7D32] dark:text-[#81C784] text-[12px] font-bold group-hover:scale-105 transition-transform">
                          +{completingChore.points || 10} pt
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Option: Everyone / ช่วยกันทำทุกคน */}
                <div className="pt-1">
                  <button
                    disabled={completingLoading}
                    onClick={() =>
                      handleConfirmComplete(
                        completingChore,
                        members.map((m) => m.id)
                      )
                    }
                    className="w-full p-3.5 rounded-[18px] bg-gradient-to-r from-[#5D4037] to-[#795548] dark:from-[#3E2820] dark:to-[#4E342A] text-white hover:opacity-95 shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[14px] bg-white/20 flex items-center justify-center text-white shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="font-dm-sans text-[14px] font-bold block leading-snug">
                          {language === 'th' ? 'ช่วยกันทำทุกคน' : 'Done by Everyone'}
                        </span>
                        <span className="text-[11px] text-white/80 block">
                          {language === 'th'
                            ? `แบ่งคะแนนคนละ +${completingChore.points || 10} pt ให้ทุกคนในบ้าน`
                            : `+${completingChore.points || 10} pt for all members`}
                        </span>
                      </div>
                    </div>

                    <div className="px-2.5 py-1 rounded-[10px] bg-white/25 text-white text-[12px] font-bold shrink-0">
                      {language === 'th' ? 'ทุกคน' : 'All'}
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCompletingChore(null)}
                  className="w-full py-2.5 rounded-[14px] text-[#8D6E63] dark:text-[#948D87] text-[12.5px] font-semibold hover:bg-[#D7CCC8]/20 transition-colors mt-2 cursor-pointer"
                >
                  {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Deletions & Uncompletes */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          description={confirmDialog.description}
        />
      </div>
    </PullToRefresh>
  );
}
