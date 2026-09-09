'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Edit3,
  Gift,
  Coins,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CheckSquare,
  Award,
  History,
  Users,
  User,
  Flame,
  Heart,
  Coffee,
  Utensils,
  Smile,
  Star,
  ShoppingBag,
  Loader2,
  Calendar as CalendarIcon,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchChores,
  createChore,
  updateChore,
  deleteChore,
  toggleChoreWithPoints,
  fetchChoreRewards,
  createChoreReward,
  updateChoreReward,
  deleteChoreReward,
  fetchRewardRedemptions,
  requestRewardRedemption,
  respondRewardRedemption,
  fetchChorePointLogs,
  fetchHouseholdMembers,
  type DbChore,
  type DbChoreReward,
  type DbRewardRedemption,
  type DbChorePointLog,
  type DbProfile,
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type ActiveTab = 'tasks' | 'rewards' | 'approvals' | 'logs';
type ChoreFilter = 'all' | 'today' | 'pending' | 'done';

const REWARD_ICONS = [
  { id: 'Gift', icon: Gift, label: 'ของขวัญ' },
  { id: 'Heart', icon: Heart, label: 'ความรัก' },
  { id: 'Coffee', icon: Coffee, label: 'เครื่องดื่ม' },
  { id: 'Utensils', icon: Utensils, label: 'มื้ออร่อย' },
  { id: 'Sparkles', icon: Sparkles, label: 'พิเศษ' },
  { id: 'Smile', icon: Smile, label: 'ตามใจ' },
  { id: 'Star', icon: Star, label: 'ดาวเด่น' },
  { id: 'ShoppingBag', icon: ShoppingBag, label: 'ช้อปปิ้ง' },
];

function getRewardIconComponent(iconName: string | null) {
  const found = REWARD_ICONS.find((i) => i.id === iconName);
  return found ? found.icon : Gift;
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
  const [rewards, setRewards] = useState<DbChoreReward[]>([]);
  const [redemptions, setRedemptions] = useState<DbRewardRedemption[]>([]);
  const [pointLogs, setPointLogs] = useState<DbChorePointLog[]>([]);

  // Navigation & Filter
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [choreFilter, setChoreFilter] = useState<ChoreFilter>('all');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<DbChore | null>(null);
  const [choreTitle, setChoreTitle] = useState('');
  const [choreFrequency, setChoreFrequency] = useState('weekly');
  const [choreAssignedTo, setChoreAssignedTo] = useState('All');
  const [chorePoints, setChorePoints] = useState(10);
  const [savingChore, setSavingChore] = useState(false);

  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<DbChoreReward | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardCost, setRewardCost] = useState(50);
  const [rewardIcon, setRewardIcon] = useState('Gift');
  const [savingReward, setSavingReward] = useState(false);

  const [redeemConfirmItem, setRedeemConfirmItem] = useState<DbChoreReward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Load all household data
  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get user profile for household_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userProfile?.household_id) {
        const hId = userProfile.household_id;
        setHouseholdId(hId);
        setMyPoints(userProfile.chore_points || 0);

        // Parallel fetch for speed
        const [mems, chs, rws, rds, pLogs] = await Promise.all([
          fetchHouseholdMembers(hId).catch(() => []),
          fetchChores(hId).catch(() => []),
          fetchChoreRewards(hId).catch(() => []),
          fetchRewardRedemptions(hId).catch(() => []),
          fetchChorePointLogs(hId).catch(() => []),
        ]);

        setMembers(mems);
        setChores(chs);
        setRewards(rws);
        setRedemptions(rds);
        setPointLogs(pLogs);

        // Sync with global store
        setStoreChores(
          chs.map((c) => ({
            id: c.id,
            title: c.title,
            frequency: (c.frequency as any) || 'weekly',
            assignedTo: c.assigned_to || 'All',
            points: c.points || 10,
            isCompleted: c.is_completed,
            dueDate: c.due_date || undefined,
          }))
        );
      }
    } catch (err) {
      console.error('Error loading chores data:', err);
    } finally {
      setLoading(false);
    }
  }, [setStoreChores]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Partner profile
  const partnerMember = useMemo(() => {
    return members.find((m) => m.id !== currentUserId) || null;
  }, [members, currentUserId]);

  const currentMember = useMemo(() => {
    return members.find((m) => m.id === currentUserId) || null;
  }, [members, currentUserId]);

  // Pending Approvals Count (items waiting for MY approval)
  const pendingApprovalsForMe = useMemo(() => {
    return redemptions.filter((r) => {
      if (r.status !== 'pending') return false;
      if (r.user_id === currentUserId) return false; // requested by me
      const myApproval = r.approvals?.[currentUserId || ''];
      return !myApproval?.approved;
    });
  }, [redemptions, currentUserId]);

  // Chore Stats
  const choreStats = useMemo(() => {
    const total = chores.length;
    const completed = chores.filter((c) => c.is_completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [chores]);

  // Filtered Chores
  const filteredChores = useMemo(() => {
    return chores.filter((c) => {
      if (choreFilter === 'pending') return !c.is_completed;
      if (choreFilter === 'done') return c.is_completed;
      if (choreFilter === 'today') {
        return c.frequency === 'daily' || c.frequency === 'once';
      }
      return true;
    });
  }, [chores, choreFilter]);

  // --- Actions ---

  // Toggle Chore Checkbox
  const handleToggleChore = async (chore: DbChore) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }

    const nextCompleted = !chore.is_completed;
    const pointsDelta = chore.points || 10;

    // Optimistic UI update
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

    setMyPoints((prev) =>
      nextCompleted ? prev + pointsDelta : Math.max(0, prev - pointsDelta)
    );

    try {
      const res = await toggleChoreWithPoints(chore.id, nextCompleted);
      if (res.success) {
        setMyPoints(res.new_balance);
        showToast(
          nextCompleted
            ? `${t.chores.choreDoneToast} +${res.points_delta} ${t.chores.pointsUnit} ✨`
            : `${t.chores.choreUndoneToast} ${Math.abs(res.points_delta)} ${t.chores.pointsUnit}`
        );

        // Send push notification if completed
        if (nextCompleted && householdId && currentUserId) {
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
                  ? `${senderName} ทำงานบ้าน '${chore.title}' เสร็จแล้ว! (+${pointsDelta} คะแนน) 🌟`
                  : `${senderName} completed '${chore.title}'! (+${pointsDelta} pts) 🌟`,
              link: '/chores',
            }),
          }).catch(() => {});
        }

        // Refresh point logs
        if (householdId) {
          fetchChorePointLogs(householdId).then(setPointLogs).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to toggle chore:', err);
      // Revert optimistic update
      loadData();
    }
  };

  // Open Create/Edit Chore Modal
  const openCreateChoreModal = () => {
    setEditingChore(null);
    setChoreTitle('');
    setChoreFrequency('weekly');
    setChoreAssignedTo('All');
    setChorePoints(10);
    setIsChoreModalOpen(true);
  };

  const openEditChoreModal = (c: DbChore) => {
    setEditingChore(c);
    setChoreTitle(c.title);
    setChoreFrequency(c.frequency || 'weekly');
    setChoreAssignedTo(c.assigned_to || 'All');
    setChorePoints(c.points || 10);
    setIsChoreModalOpen(true);
  };

  // Submit Chore Form
  const handleSaveChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choreTitle.trim() || !householdId || !currentUserId) return;
    setSavingChore(true);

    try {
      if (editingChore) {
        const updated = await updateChore(editingChore.id, {
          title: choreTitle.trim(),
          frequency: choreFrequency,
          assigned_to: choreAssignedTo,
          points: chorePoints,
        });
        setChores((prev) =>
          prev.map((c) => (c.id === editingChore.id ? { ...c, ...updated } : c))
        );
        showToast(language === 'th' ? 'แก้ไขงานบ้านเรียบร้อย' : 'Chore updated');
      } else {
        const created = await createChore(householdId, currentUserId, {
          title: choreTitle.trim(),
          frequency: choreFrequency,
          assigned_to: choreAssignedTo,
          points: chorePoints,
        });
        setChores((prev) => [created, ...prev]);
        showToast(language === 'th' ? 'เพิ่มงานบ้านสำเร็จ' : 'Chore added');
      }
      setIsChoreModalOpen(false);
    } catch (err) {
      console.error('Error saving chore:', err);
    } finally {
      setSavingChore(false);
    }
  };

  // Delete Chore
  const handleDeleteChore = async (choreId: string) => {
    if (!confirm(t.chores.confirmDeleteChore)) return;
    try {
      await deleteChore(choreId);
      setChores((prev) => prev.filter((c) => c.id !== choreId));
      showToast(language === 'th' ? 'ลบงานบ้านเรียบร้อย' : 'Chore deleted');
    } catch (err) {
      console.error('Error deleting chore:', err);
    }
  };

  // Open Create/Edit Reward Modal
  const openCreateRewardModal = () => {
    setEditingReward(null);
    setRewardTitle('');
    setRewardDesc('');
    setRewardCost(50);
    setRewardIcon('Gift');
    setIsRewardModalOpen(true);
  };

  const openEditRewardModal = (r: DbChoreReward) => {
    setEditingReward(r);
    setRewardTitle(r.title);
    setRewardDesc(r.description || '');
    setRewardCost(r.points_cost);
    setRewardIcon(r.icon || 'Gift');
    setIsRewardModalOpen(true);
  };

  // Submit Reward Form
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim() || !householdId || !currentUserId) return;
    setSavingReward(true);

    try {
      if (editingReward) {
        const updated = await updateChoreReward(editingReward.id, {
          title: rewardTitle.trim(),
          description: rewardDesc.trim() || null,
          points_cost: rewardCost,
          icon: rewardIcon,
        });
        setRewards((prev) =>
          prev.map((r) => (r.id === editingReward.id ? { ...r, ...updated } : r))
        );
        showToast(language === 'th' ? 'แก้ไขของรางวัลเรียบร้อย' : 'Reward updated');
      } else {
        const created = await createChoreReward(householdId, currentUserId, {
          title: rewardTitle.trim(),
          description: rewardDesc.trim() || undefined,
          points_cost: rewardCost,
          icon: rewardIcon,
        });
        setRewards((prev) => [created, ...prev]);
        showToast(language === 'th' ? 'สร้างของรางวัลใหม่สำเร็จ' : 'Reward created');
      }
      setIsRewardModalOpen(false);
    } catch (err) {
      console.error('Error saving reward:', err);
    } finally {
      setSavingReward(false);
    }
  };

  // Delete Reward
  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm(t.chores.confirmDeleteReward)) return;
    try {
      await deleteChoreReward(rewardId);
      setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      showToast(language === 'th' ? 'ลบของรางวัลเรียบร้อย' : 'Reward deleted');
    } catch (err) {
      console.error('Error deleting reward:', err);
    }
  };

  // Request Reward Redemption
  const handleConfirmRedeem = async () => {
    if (!redeemConfirmItem || !householdId || !currentUserId) return;
    if (myPoints < redeemConfirmItem.points_cost) {
      alert(t.chores.insufficientPoints);
      return;
    }

    setRedeeming(true);
    try {
      const res = await requestRewardRedemption(redeemConfirmItem.id);
      if (res.success) {
        showToast(t.chores.redeemSuccessToast);
        setRedeemConfirmItem(null);

        // Notify partner
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
            title: '🎁 Bobbies Homie',
            body:
              language === 'th'
                ? `${senderName} ขอแลกรางวัล '${redeemConfirmItem.title}' (${redeemConfirmItem.points_cost} คะแนน) กรุณาอนุมัติ! ✨`
                : `${senderName} requested '${redeemConfirmItem.title}' (${redeemConfirmItem.points_cost} pts). Please approve! ✨`,
            link: '/chores',
          }),
        }).catch(() => {});

        // Refresh redemptions list
        const updatedReds = await fetchRewardRedemptions(householdId);
        setRedemptions(updatedReds);
        setActiveTab('approvals');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to request redemption');
    } finally {
      setRedeeming(false);
    }
  };

  // Respond to Redemption (Approve / Reject)
  const handleRespondRedemption = async (
    redemption: DbRewardRedemption,
    approved: boolean
  ) => {
    if (!householdId) return;
    try {
      const res = await respondRewardRedemption(redemption.id, approved);
      if (res.success) {
        showToast(
          approved ? t.chores.approveSuccessToast : t.chores.rejectSuccessToast
        );

        // Notify requester
        const approverName =
          currentMember?.nickname ||
          currentMember?.full_name ||
          (language === 'th' ? 'คนในบ้าน' : 'Partner');
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: approved ? '🎉 Bobbies Homie' : 'แจ้งเตือน Bobbies Homie',
            body: approved
              ? `${approverName} อนุมัติการแลกรางวัล '${redemption.reward_title}' แล้ว! ✨`
              : `${approverName} ปฏิเสธคำขอแลกรางวัล '${redemption.reward_title}'`,
            link: '/chores',
          }),
        }).catch(() => {});

        // Refresh redemptions, logs, and current user points
        loadData();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to respond to redemption');
    }
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-32 transition-colors duration-200">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#5D4037] text-white text-[13px] font-semibold shadow-lg animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#F2C94C]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push('/dashboard')}
              aria-label="Back to dashboard"
              className="p-1 -ml-1 text-[#5D4037] dark:text-[#DDD7D2] hover:opacity-75 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="font-outfit font-bold text-[22px] leading-[26px] text-[#5D4037] dark:text-[#DDD7D2]">
                {t.chores.title}
              </h1>
              <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                {t.chores.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </div>

        {/* Points Summary Header Card */}
        <div className="px-6 pt-2 pb-3">
          <div className="p-4 rounded-[22px] bg-gradient-to-br from-[#F4EFEA] to-[#EBE4DC] dark:from-[#24211E] dark:to-[#1C1A18] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xs">
            <div className="flex items-center justify-between">
              {/* My Score */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[16px] bg-[#5D4037] text-white flex items-center justify-center shadow-xs">
                  <Coins className="w-6 h-6 text-[#F2C94C]" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#8D6E63] dark:text-[#948D87] uppercase tracking-wider block">
                    {t.chores.myPoints}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-outfit font-extrabold text-[26px] leading-[30px] text-[#5D4037] dark:text-[#DDD7D2]">
                      {myPoints}
                    </span>
                    <span className="text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87]">
                      {t.chores.pointsUnit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Partner Score */}
              {partnerMember && (
                <div className="text-right border-l border-[#D7CCC8]/60 dark:border-[#2E2A27] pl-4">
                  <span className="text-[11px] font-medium text-[#8D6E63] dark:text-[#948D87] block">
                    {partnerMember.nickname || partnerMember.full_name}
                  </span>
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="font-outfit font-bold text-[18px] text-[#5D4037]/80 dark:text-[#DDD7D2]/80">
                      {partnerMember.chore_points || 0}
                    </span>
                    <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      {t.chores.pointsUnit}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Chores Progress Ring Bar */}
            <div className="mt-3 pt-3 border-t border-[#D7CCC8]/50 dark:border-[#2E2A27]/60 flex items-center justify-between text-[12px]">
              <span className="text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>
                  {t.dashboard.todayChores}: {choreStats.completed} / {choreStats.total} {t.dashboard.choresDone}
                </span>
              </span>
              <span className="font-bold text-[#2E7D32] dark:text-[#81C784]">
                {choreStats.percent}%
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill */}
        <div className="px-6 py-1">
          <div className="flex items-center p-1 bg-[#F4EFEA] dark:bg-[#23201D] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[18px]">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t.chores.tabTasks}</span>
            </button>

            <button
              onClick={() => setActiveTab('rewards')}
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rewards'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87]'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{t.chores.tabRewards}</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`relative flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.chores.tabApprovals}</span>
              {pendingApprovalsForMe.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#E0533C] text-white text-[9px] font-extrabold flex items-center justify-center ml-0.5 animate-pulse">
                  {pendingApprovalsForMe.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t.chores.tabLogs}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: CHORES TASKS                                      */}
        {/* ======================================================== */}
        {activeTab === 'tasks' && (
          <div className="px-6 pt-3 space-y-3">
            {/* Filter Pills and Add Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(['all', 'today', 'pending', 'done'] as ChoreFilter[]).map(
                  (f) => (
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
                  )
                )}
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
                      {/* Left: Checkbox & Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggleChore(chore)}
                          aria-label={chore.is_completed ? 'Mark undone' : 'Mark done'}
                          className={`w-7 h-7 rounded-[10px] flex items-center justify-center border-2 transition-all shrink-0 cursor-pointer ${
                            chore.is_completed
                              ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-xs'
                              : 'border-[#D7CCC8] dark:border-[#5D4037] hover:border-[#2E7D32]'
                          }`}
                        >
                          {chore.is_completed && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-[14px] font-bold truncate ${
                              chore.is_completed
                                ? 'line-through text-[#8D6E63]/60 dark:text-[#948D87]/60'
                                : 'text-[#5D4037] dark:text-[#DDD7D2]'
                            }`}
                          >
                            {chore.title}
                          </h3>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-[8px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] border border-[#D7CCC8]/60 dark:border-[#2E2A27]">
                              {chore.frequency === 'daily' && 'รายวัน'}
                              {chore.frequency === 'weekly' && 'รายสัปดาห์'}
                              {chore.frequency === 'monthly' && 'รายเดือน'}
                              {chore.frequency === 'once' && 'ครั้งเดียว'}
                            </span>

                            {chore.assigned_to && chore.assigned_to !== 'All' && (
                              <span className="text-[11px] font-medium text-[#8D6E63] dark:text-[#948D87] flex items-center gap-0.5">
                                <User className="w-3 h-3" />
                                {chore.assigned_to}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Points Badge */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-[#E8F5E9] dark:bg-[#1B5E20]/30 text-[#2E7D32] dark:text-[#81C784] text-[12px] font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#2E7D32]" />
                          +{chore.points || 10}
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
        {/* TAB 2: REWARD STORE                                      */}
        {/* ======================================================== */}
        {activeTab === 'rewards' && (
          <div className="px-6 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.tabRewards}
                </h2>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  ใช้คะแนนแลกรางวัลที่คนในบ้านสร้างไว้
                </p>
              </div>

              <button
                onClick={openCreateRewardModal}
                className="px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.chores.createReward}</span>
              </button>
            </div>

            {rewards.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <Gift className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.noRewards}
                </p>
                <button
                  onClick={openCreateRewardModal}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] hover:underline cursor-pointer"
                >
                  + {t.chores.createReward}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {rewards.map((reward) => {
                  const IconComponent = getRewardIconComponent(reward.icon);
                  const canAfford = myPoints >= reward.points_cost;

                  return (
                    <SwipeableRow
                      key={reward.id}
                      onEdit={() => openEditRewardModal(reward)}
                      onDelete={() => handleDeleteReward(reward.id)}
                      className="rounded-[18px]"
                    >
                      <div className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3">
                        {/* Icon & Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-11 h-11 rounded-[14px] bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-center shrink-0">
                            <IconComponent className="w-5 h-5 text-[#5D4037] dark:text-[#DDD7D2]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                              {reward.title}
                            </h3>
                            {reward.description && (
                              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate">
                                {reward.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="font-outfit font-extrabold text-[13px] text-[#E0533C]">
                                {reward.points_cost}
                              </span>
                              <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                                {t.chores.pointsUnit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Redeem Action Button */}
                        <button
                          onClick={() => setRedeemConfirmItem(reward)}
                          disabled={!canAfford}
                          className={`px-3.5 py-2 rounded-[12px] text-[12px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                            canAfford
                              ? 'bg-[#5D4037] text-white hover:opacity-90 shadow-xs'
                              : 'bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63]/60 dark:text-[#948D87]/60 cursor-not-allowed'
                          }`}
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>{t.chores.redeem}</span>
                        </button>
                      </div>
                    </SwipeableRow>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: APPROVAL QUEUE                                    */}
        {/* ======================================================== */}
        {activeTab === 'approvals' && (
          <div className="px-6 pt-3 space-y-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {t.chores.pendingApprovals}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                การแลกรางวัลต้องได้รับความเห็นชอบจากทุกคนในบ้าน
              </p>
            </div>

            {redemptions.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <Clock className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.noApprovals}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {redemptions.map((red) => {
                  const isRequester = red.user_id === currentUserId;
                  const requesterName =
                    red.user?.nickname ||
                    red.user?.full_name ||
                    (isRequester ? (language === 'th' ? 'ฉัน' : 'Me') : 'เพื่อนร่วมบ้าน');

                  const isPending = red.status === 'pending';
                  const isApproved = red.status === 'approved';
                  const isRejected = red.status === 'rejected';

                  return (
                    <div
                      key={red.id}
                      className="p-4 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[20px] space-y-3 shadow-xs"
                    >
                      {/* Top status header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{requesterName} ขอแลก:</span>
                        </span>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D]'
                              : isApproved
                              ? 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1B5E20]/20 dark:text-[#81C784]'
                              : 'bg-[#FFEBEE] text-[#C62828] dark:bg-[#B71C1C]/20 dark:text-[#EF9A9A]'
                          }`}
                        >
                          {isPending && t.chores.waitingApproval}
                          {isApproved && t.chores.approved}
                          {isRejected && t.chores.rejected}
                        </span>
                      </div>

                      {/* Reward item info */}
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <h3 className="text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                            {red.reward_title}
                          </h3>
                          <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            {red.created_at ? new Date(red.created_at).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-outfit font-extrabold text-[18px] text-[#E0533C]">
                            -{red.points_spent}
                          </span>
                          <span className="text-[11px] font-semibold text-[#8D6E63] dark:text-[#948D87] ml-1">
                            {t.chores.pointsUnit}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons (only if pending and NOT requested by current user) */}
                      {isPending && !isRequester && (
                        <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] flex items-center gap-2">
                          <button
                            onClick={() => handleRespondRedemption(red, false)}
                            className="flex-1 py-2 rounded-[12px] bg-[#F4EFEA] dark:bg-[#292522] text-[#C62828] text-[12px] font-bold hover:bg-[#FFEBEE] transition-colors cursor-pointer"
                          >
                            {t.chores.reject}
                          </button>
                          <button
                            onClick={() => handleRespondRedemption(red, true)}
                            className="flex-1 py-2 rounded-[12px] bg-[#2E7D32] text-white text-[12px] font-bold hover:bg-[#1B5E20] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t.chores.approve}</span>
                          </button>
                        </div>
                      )}

                      {/* Requester waiting status */}
                      {isPending && isRequester && (
                        <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] text-center text-[12px] text-[#8D6E63] dark:text-[#948D87] flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>{t.chores.waitingOthers}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: POINT HISTORY & BALANCE SNAPSHOT                  */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="px-6 pt-3 space-y-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {t.chores.tabLogs}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                บันทึกคะแนนที่ได้และใช้ พร้อมยอดคงเหลือ ณ ขณะนั้น
              </p>
            </div>

            {pointLogs.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <History className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.noLogs}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pointLogs.map((log) => {
                  const isPositive = log.points_delta > 0;
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
                            • {log.created_at ? new Date(log.created_at).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <h4 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                          {log.title}
                        </h4>

                        {/* Promptly display the snapshot balance at that moment as requested */}
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            {t.chores.balanceSnapshot}:
                          </span>
                          <span className="text-[11px] font-bold text-[#5D4037] dark:text-[#DDD7D2] bg-[#F4EFEA] dark:bg-[#282421] px-1.5 py-0.2 rounded-[6px]">
                            {log.balance_after} {t.chores.pointsUnit}
                          </span>
                        </div>
                      </div>

                      {/* Right: Points Delta */}
                      <div className="text-right shrink-0">
                        <span
                          className={`font-outfit font-extrabold text-[16px] ${
                            isPositive
                              ? 'text-[#2E7D32] dark:text-[#81C784]'
                              : 'text-[#E0533C]'
                          }`}
                        >
                          {isPositive ? `+${log.points_delta}` : log.points_delta}
                        </span>
                        <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87] ml-1">
                          {t.chores.pointsUnit}
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
        {/* MODAL 1: ADD / EDIT CHORE                                */}
        {/* ======================================================== */}
        {isChoreModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-[390px] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] p-5 shadow-xl animate-in zoom-in-95 duration-200">
              <h2 className="text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-3.5">
                {editingChore ? t.chores.editChore : t.chores.addChore}
              </h2>

              <form onSubmit={handleSaveChore} className="space-y-3.5">
                <div>
                  <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.create.choreTitlePlaceholder} *
                  </label>
                  <input
                    type="text"
                    required
                    value={choreTitle}
                    onChange={(e) => setChoreTitle(e.target.value)}
                    placeholder="เช่น กวาดบ้าน, ล้างห้องน้ำ, ซักผ้าปูที่นอน"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {t.chores.frequency}
                    </label>
                    <select
                      value={choreFrequency}
                      onChange={(e) => setChoreFrequency(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                    >
                      <option value="daily">{t.create.daily}</option>
                      <option value="weekly">{t.create.weekly}</option>
                      <option value="monthly">{t.create.monthly}</option>
                      <option value="once">ครั้งเดียว</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {t.chores.assignedTo}
                    </label>
                    <select
                      value={choreAssignedTo}
                      onChange={(e) => setChoreAssignedTo(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                    >
                      <option value="All">{t.chores.allMembers}</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.nickname || m.full_name}>
                          {m.nickname || m.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                    คะแนนที่ได้รับเมื่อทำสำเร็จ ⭐
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 20, 50].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setChorePoints(val)}
                        className={`flex-1 py-1.5 rounded-[10px] text-[12px] font-bold transition-all cursor-pointer ${
                          chorePoints === val
                            ? 'bg-[#5D4037] text-white dark:bg-[#DDD7D2] dark:text-[#1A1816]'
                            : 'bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2]'
                        }`}
                      >
                        +{val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChoreModalOpen(false)}
                    className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingChore}
                    className="flex-1 py-2.5 bg-[#5D4037] text-white rounded-[14px] text-[13px] font-bold hover:opacity-90 transition-opacity shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {savingChore && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>บันทึก</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 2: ADD / EDIT REWARD                               */}
        {/* ======================================================== */}
        {isRewardModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-[390px] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] p-5 shadow-xl animate-in zoom-in-95 duration-200">
              <h2 className="text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-3.5">
                {editingReward ? t.chores.editReward : t.chores.createReward}
              </h2>

              <form onSubmit={handleSaveReward} className="space-y-3.5">
                <div>
                  <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.chores.rewardTitle} *
                  </label>
                  <input
                    type="text"
                    required
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder={t.chores.rewardTitlePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.chores.rewardDesc}
                  </label>
                  <input
                    type="text"
                    value={rewardDesc}
                    onChange={(e) => setRewardDesc(e.target.value)}
                    placeholder="เช่น นวดแก้ปวดเมื่อยหลังจากกวาดบ้านเหนื่อยๆ"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.chores.pointsCost} *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={rewardCost}
                    onChange={(e) => setRewardCost(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] mb-1">
                    ไอคอนของรางวัล
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {REWARD_ICONS.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = rewardIcon === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setRewardIcon(item.id)}
                          className={`p-2 rounded-[12px] flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#5D4037] text-white'
                              : 'bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2]'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                          <span className="text-[10px]">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRewardModalOpen(false)}
                    className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingReward}
                    className="flex-1 py-2.5 bg-[#5D4037] text-white rounded-[14px] text-[13px] font-bold hover:opacity-90 transition-opacity shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {savingReward && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>บันทึก</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 3: REDEEM CONFIRMATION                             */}
        {/* ======================================================== */}
        {redeemConfirmItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] p-5 shadow-xl animate-in zoom-in-95 duration-200 text-center">
              <div className="w-14 h-14 rounded-[20px] bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8] dark:border-[#2E2A27] flex items-center justify-center mx-auto mb-3 text-[#5D4037] dark:text-[#DDD7D2]">
                <Gift className="w-7 h-7" />
              </div>

              <h3 className="text-[17px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                {t.chores.redeemConfirmTitle}
              </h3>
              <p className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                {redeemConfirmItem.title}
              </p>
              <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87] mb-3">
                {t.chores.redeemConfirmDesc}
              </p>

              <div className="p-3 bg-[#F4EFEA] dark:bg-[#282421] rounded-[16px] mb-4 text-[13px] flex items-center justify-between">
                <span className="text-[#8D6E63] dark:text-[#948D87]">{t.chores.cost}:</span>
                <span className="font-extrabold text-[#E0533C]">
                  {redeemConfirmItem.points_cost} {t.chores.pointsUnit}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRedeemConfirmItem(null)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={handleConfirmRedeem}
                  className="flex-1 py-2.5 bg-[#5D4037] text-white rounded-[14px] text-[13px] font-bold hover:opacity-90 transition-opacity shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>ยืนยันแลก</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
