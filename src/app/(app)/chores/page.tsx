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
  Loader2,
  Calendar as CalendarIcon,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchChores,
  createChore,
  updateChore,
  deleteChore,
  toggleChoreWithPoints,
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
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type ActiveTab = 'tasks' | 'logs';
type ChoreFilter = 'all' | 'today' | 'pending' | 'done';

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

  // Modals for Chore
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<DbChore | null>(null);
  const [choreTitle, setChoreTitle] = useState('');
  const [choreFrequency, setChoreFrequency] = useState('weekly');
  const [choreAssignedTo, setChoreAssignedTo] = useState('All');
  const [chorePoints, setChorePoints] = useState(10);
  const [savingChore, setSavingChore] = useState(false);

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Load all chores and chore logs
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

        setChores(choresRes);
        setPointLogs(pointLogsRes);
        setMembers(membersRes);
        setActiveGachaSpin(activeSpinRes);
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

  // Partner member
  const partnerMember = useMemo(() => {
    return members.find((m) => m.id !== currentUserId);
  }, [members, currentUserId]);

  // Filtered Chores
  const filteredChores = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return chores.filter((chore) => {
      if (choreFilter === 'pending') return !chore.is_completed;
      if (choreFilter === 'done') return chore.is_completed;
      if (choreFilter === 'today') {
        if (!chore.due_date) return true;
        return chore.due_date.split('T')[0] === todayStr;
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

  // Separate Chore Completion Log (ชื่องานบ้าน, วันที่, คะแนนที่ได้)
  const choreLogs = useMemo(() => {
    return pointLogs.filter(
      (log) => log.type === 'chore_complete' || log.points_delta > 0
    );
  }, [pointLogs]);

  // Toggle Chore Checkmark
  const handleToggleChore = async (chore: DbChore) => {
    if (!currentUserId || !householdId) return;

    try {
      const nextCompleted = !chore.is_completed;
      const basePoints = chore.points || 10;
      const hasMultiplier =
        activeGachaSpin &&
        activeGachaSpin.is_active &&
        (activeGachaSpin.chore_id === chore.id ||
          activeGachaSpin.chore_title.trim().toLowerCase() === chore.title.trim().toLowerCase());

      const pointsDelta = hasMultiplier
        ? basePoints * activeGachaSpin.multiplier
        : basePoints;

      // Optimistic update
      setChores((prev) =>
        prev.map((c) =>
          c.id === chore.id
            ? {
                ...c,
                is_completed: nextCompleted,
                completed_at: nextCompleted ? new Date().toISOString() : null,
              }
            : c
        )
      );

      const res = await toggleChoreWithPoints(chore.id, nextCompleted);

      if (res.success) {
        setMyPoints(res.new_balance);
        showToast(
          nextCompleted
            ? language === 'th'
              ? `ทำงานบ้านเสร็จแล้ว (+${pointsDelta} pt)`
              : `Chore completed (+${pointsDelta} pt)`
            : language === 'th'
            ? 'ยกเลิกการทำงานบ้าน'
            : 'Chore uncompleted'
        );

        if (nextCompleted) {
          const senderName =
            currentMember?.nickname ||
            currentMember?.full_name ||
            (language === 'th' ? 'คนในบ้าน' : 'Homie');
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId,
              excludeUserId: currentUserId,
              title: '🧹 Bobbies Homie',
              body:
                language === 'th'
                  ? `${senderName} ทำงานบ้าน '${chore.title}' เสร็จแล้ว!`
                  : `${senderName} completed '${chore.title}'!`,
              link: '/chores',
            }),
          }).catch(() => {});
        }

        // Refresh point logs in background
        if (householdId) {
          fetchChorePointLogs(householdId).then(setPointLogs).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to toggle chore:', err);
      loadData();
    }
  };

  // Open Create Chore Modal
  const openCreateChoreModal = () => {
    setEditingChore(null);
    setChoreTitle('');
    setChoreFrequency('weekly');
    setChoreAssignedTo('All');
    setChorePoints(10);
    setIsChoreModalOpen(true);
  };

  // Open Edit Chore Modal
  const openEditChoreModal = (c: DbChore) => {
    setEditingChore(c);
    setChoreTitle(c.title);
    setChoreFrequency(c.frequency);
    setChoreAssignedTo(c.assigned_to || 'All');
    setChorePoints(c.points || 10);
    setIsChoreModalOpen(true);
  };

  // Handle Save Chore
  const handleSaveChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !currentUserId || !choreTitle.trim()) return;

    try {
      setSavingChore(true);
      const sanitizedAssignedTo =
        choreAssignedTo === 'All' || !choreAssignedTo ? null : choreAssignedTo;

      if (!editingChore) {
        await createChore(householdId, currentUserId, {
          title: choreTitle.trim(),
          frequency: choreFrequency,
          assigned_to: sanitizedAssignedTo,
          points: chorePoints,
        });
        showToast(language === 'th' ? 'เพิ่มงานบ้านสำเร็จ' : 'Chore added');
      } else {
        await updateChore(editingChore.id, {
          title: choreTitle.trim(),
          frequency: choreFrequency,
          assigned_to: sanitizedAssignedTo,
          points: chorePoints,
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

  // Handle Delete Chore
  const handleDeleteChore = async (choreId: string) => {
    if (!confirm(language === 'th' ? 'ยืนยันที่จะลบงานบ้านนี้?' : 'Delete this chore?')) return;
    try {
      await deleteChore(choreId);
      showToast(language === 'th' ? 'ลบงานบ้านเรียบร้อย' : 'Chore deleted');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete chore');
    }
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="w-full max-w-md mx-auto min-h-screen pb-28 pt-4 select-none">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#5D4037] text-white px-4 py-2.5 rounded-full shadow-lg text-[13px] font-semibold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-[#81C784]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="px-6 flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-[14px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] hover:opacity-80 transition-all shrink-0"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>

            <div>
              <h1 className="text-[20px] font-bold text-[#5D4037] dark:text-[#DDD7D2] leading-tight flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-[#2E7D32]" />
                <span>{language === 'th' ? 'งานบ้าน' : 'Chores'}</span>
              </h1>
              <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th' ? 'ช่วยกันดูแลบ้านให้สะอาดน่าอยู่' : 'Keeping our home cozy and clean'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Link to Rewards Shop */}
            <Link
              href="/rewards"
              className="px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-80 transition-colors shadow-2xs"
            >
              <Gift className="w-3.5 h-3.5 text-[#E0533C]" />
              <span>{language === 'th' ? 'ร้านค้า' : 'Shop'}</span>
            </Link>

            <NotificationBell />
          </div>
        </div>

        {/* ======================================================== */}
        {/* CHORES PROGRESS CARD (EMPHASIZES TASKS, NOT FLASHY POINTS) */}
        {/* ======================================================== */}
        <div className="px-6 mb-3">
          <div className="p-4 bg-gradient-to-br from-[#FFFDF9] to-[#F7F3ED] dark:from-[#23201D] dark:to-[#1B1917] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.05)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87] uppercase tracking-wide">
                  {t.dashboard.todayChores}
                </span>
                <div className="text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mt-0.5">
                  {choreStats.completed} / {choreStats.total} {t.dashboard.choresDone}
                </div>
              </div>

              {/* Minimal Progress Ring or Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#2E7D32] dark:text-[#81C784] bg-[#E8F5E9] dark:bg-[#1B5E20]/30 px-2.5 py-1 rounded-[10px]">
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

            {/* Subtle Footnote: Unobtrusive Points Mention & Link */}
            <div className="mt-3 pt-2.5 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] flex items-center justify-between text-[11px] text-[#8D6E63] dark:text-[#948D87]">
              <span>
                {language === 'th' ? 'คะแนนสะสมของคุณ:' : 'Your Points:'}{' '}
                <span className="font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
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
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'รายการงานบ้าน' : 'Tasks'}</span>
              {choreStats.completed < choreStats.total && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#8D6E63]/15 text-[10px] font-bold">
                  {choreStats.total - choreStats.completed}
                </span>
              )}
            </button>

            {/* Tab 2: ประวัติงานบ้าน */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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
                className="shrink-0 px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 cursor-pointer"
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
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
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
                {filteredChores.map((chore) => (
                  <SwipeableRow
                    key={chore.id}
                    onEdit={() => openEditChoreModal(chore)}
                    onDelete={() => handleDeleteChore(chore.id)}
                    className="rounded-[18px]"
                  >
                    <div className="w-full p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 transition-colors">
                      {/* Left: Checkbox & Chore Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggleChore(chore)}
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
                          <span
                            className={`text-[14px] font-bold block truncate transition-all ${
                              chore.is_completed
                                ? 'line-through text-[#8D6E63]/60 dark:text-[#948D87]/60'
                                : 'text-[#5D4037] dark:text-[#DDD7D2]'
                            }`}
                          >
                            {chore.title}
                          </span>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            <span className="capitalize">
                              {chore.frequency === 'daily' && t.create.daily}
                              {chore.frequency === 'weekly' && t.create.weekly}
                              {chore.frequency === 'monthly' && t.create.monthly}
                              {chore.frequency === 'once' && 'ครั้งเดียว'}
                            </span>
                            {chore.assigned_to && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <User className="w-3 h-3" />
                                  <span>
                                    {members.find((m) => m.id === chore.assigned_to)?.nickname ||
                                      members.find((m) => m.id === chore.assigned_to)?.full_name ||
                                      'ทุกคน'}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: SUBTLE / MUTED POINTS (NOT FLASHY) */}
                      <div className="shrink-0 text-right">
                        <span className="text-[11px] font-medium text-[#8D6E63] dark:text-[#948D87] bg-[#F4EFEA] dark:bg-[#282421] px-2 py-0.5 rounded-[8px]">
                          {chore.points || 10} pt
                        </span>
                      </div>
                    </div>
                  </SwipeableRow>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CHORE COMPLETION LOG (งานบ้าน, วันที่, คะแนน)       */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="px-6 pt-2 space-y-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'ประวัติการทำงานบ้าน' : 'Chore Completion Log'}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th' ? 'รายการงานบ้านที่ทำเสร็จแล้ว วันที่ และคะแนนที่ได้รับ' : 'Completed chores, date completed, and points earned'}
              </p>
            </div>

            {choreLogs.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <History className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'ยังไม่มีประวัติการทำงานบ้าน' : 'No chore completion history yet'}
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
                          <span className="text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87]">
                            {logUserName}
                          </span>
                          <span className="text-[10px] text-[#8D6E63]/60 dark:text-[#948D87]/60">
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

                        <h4 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                          {log.title}
                        </h4>
                      </div>

                      {/* Right: Subtle points earned */}
                      <div className="text-right shrink-0">
                        <span className="font-outfit font-semibold text-[14px] text-[#2E7D32] dark:text-[#81C784]">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up">
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {editingChore ? t.chores.editChore : t.chores.addChore}
                </h3>
                <button
                  onClick={() => setIsChoreModalOpen(false)}
                  className="p-1 rounded-full text-[#8D6E63] hover:bg-[#D7CCC8]/30 cursor-pointer"
                >
                  <Check className="w-5 h-5 hidden" />
                  <span className="text-[18px] text-[#8D6E63]">&times;</span>
                </button>
              </div>

              <form onSubmit={handleSaveChore} className="p-6 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    ชื่องานบ้าน
                  </label>
                  <input
                    type="text"
                    required
                    value={choreTitle}
                    onChange={(e) => setChoreTitle(e.target.value)}
                    placeholder="เช่น กวาดบ้าน, ล้างจาน, ทิ้งขยะ"
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                      {t.chores.frequency}
                    </label>
                    <select
                      value={choreFrequency}
                      onChange={(e) => setChoreFrequency(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                    >
                      <option value="daily">{t.create.daily}</option>
                      <option value="weekly">{t.create.weekly}</option>
                      <option value="monthly">{t.create.monthly}</option>
                      <option value="once">ครั้งเดียว</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                      คะแนนที่ได้รับ
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={chorePoints}
                      onChange={(e) => setChorePoints(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] font-outfit font-bold focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.assignedTo}
                  </label>
                  <select
                    value={choreAssignedTo}
                    onChange={(e) => setChoreAssignedTo(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  >
                    <option value="All">{t.chores.allMembers}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nickname || m.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChoreModalOpen(false)}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] text-[13px] font-bold cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingChore}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
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
      </div>
    </PullToRefresh>
  );
}
