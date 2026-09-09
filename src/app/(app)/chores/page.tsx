'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Sparkles,
  Check,
  X,
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
  RefreshCw,
  Settings2,
  ShieldCheck,
  ArrowRight,
  Dice5,
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
  proposeCreateChoreReward,
  proposeEditChoreReward,
  proposeDeleteChoreReward,
  cancelChoreRewardProposal,
  respondChoreRewardProposal,
  fetchRewardRedemptions,
  requestRewardRedemption,
  respondRewardRedemption,
  fetchChorePointLogs,
  fetchHouseholdMembers,
  fetchChoreGachaSpins,
  fetchMyActiveGachaSpin,
  spinChoreGacha,
  type DbChore,
  type DbChoreReward,
  type DbRewardRedemption,
  type DbChorePointLog,
  type DbProfile,
  type DbChoreGachaSpin,
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type ActiveTab = 'tasks' | 'rewards' | 'logs' | 'manage';
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

  // Modals for Chore
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<DbChore | null>(null);
  const [choreTitle, setChoreTitle] = useState('');
  const [choreFrequency, setChoreFrequency] = useState('weekly');
  const [choreAssignedTo, setChoreAssignedTo] = useState('All');
  const [chorePoints, setChorePoints] = useState(10);
  const [savingChore, setSavingChore] = useState(false);

  // Modals for Reward Management
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<DbChoreReward | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardCost, setRewardCost] = useState(50);
  const [rewardIcon, setRewardIcon] = useState('Gift');
  const [savingReward, setSavingReward] = useState(false);

  // Modal for Redeem Confirmation
  const [redeemConfirmItem, setRedeemConfirmItem] = useState<DbChoreReward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Mystery Box Gacha in Reward Shop
  const [activeGachaSpin, setActiveGachaSpin] = useState<DbChoreGachaSpin | null>(null);
  const [gachaSpins, setGachaSpins] = useState<DbChoreGachaSpin[]>([]);
  const [isGachaModalOpen, setIsGachaModalOpen] = useState(false);
  const [isGachaHistoryModalOpen, setIsGachaHistoryModalOpen] = useState(false);
  const [isSpinningGacha, setIsSpinningGacha] = useState(false);
  const [spinResult, setSpinResult] = useState<{ chore_title: string; multiplier: number } | null>(null);

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
        const [mems, chs, rws, rds, pLogs, activeSpin, spins] = await Promise.all([
          fetchHouseholdMembers(hId).catch(() => []),
          fetchChores(hId).catch(() => []),
          fetchChoreRewards(hId).catch(() => []),
          fetchRewardRedemptions(hId).catch(() => []),
          fetchChorePointLogs(hId).catch(() => []),
          fetchMyActiveGachaSpin(user.id).catch(() => null),
          fetchChoreGachaSpins(hId).catch(() => []),
        ]);

        setMembers(mems);
        setChores(chs);
        setRewards(rws);
        setRedemptions(rds);
        setPointLogs(pLogs);
        setActiveGachaSpin(activeSpin);
        setGachaSpins(spins);

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

  // Active Approved Rewards for the Shop (Browse & Redeem only)
  const activeShopRewards = useMemo(() => {
    return rewards.filter((r) => !r.status || r.status === 'active');
  }, [rewards]);

  // Pending Reward Proposals (Create, Edit, Delete)
  const pendingRewardProposals = useMemo(() => {
    return rewards.filter(
      (r) =>
        r.status === 'pending_create' ||
        r.status === 'pending_edit' ||
        r.status === 'pending_delete'
    );
  }, [rewards]);

  // Pending Reward Redemptions
  const pendingRedemptions = useMemo(() => {
    return redemptions.filter((r) => r.status === 'pending');
  }, [redemptions]);

  // Count of pending items specifically waiting for MY approval
  const totalPendingApprovalsForMe = useMemo(() => {
    if (!currentUserId) return 0;
    // 1. Reward proposals waiting for me
    const proposalsForMe = pendingRewardProposals.filter(
      (r) => r.proposed_by && r.proposed_by !== currentUserId
    ).length;
    // 2. Redemptions waiting for me
    const redemptionsForMe = pendingRedemptions.filter((r) => {
      if (r.user_id === currentUserId) return false;
      const myApproval = r.approvals?.[currentUserId];
      return !myApproval?.approved;
    }).length;
    return proposalsForMe + redemptionsForMe;
  }, [pendingRewardProposals, pendingRedemptions, currentUserId]);

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
          frequency: choreFrequency as any,
          assigned_to: choreAssignedTo === 'All' ? null : choreAssignedTo,
          points: chorePoints,
        });
        setChores((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast(language === 'th' ? 'แก้ไขงานบ้านเรียบร้อย' : 'Chore updated');
      } else {
        const created = await createChore(householdId, currentUserId, {
          title: choreTitle.trim(),
          frequency: choreFrequency as any,
          assigned_to: choreAssignedTo === 'All' ? null : choreAssignedTo,
          points: chorePoints,
        });
        setChores((prev) => [created, ...prev]);
        showToast(language === 'th' ? 'เพิ่มงานบ้านเรียบร้อย' : 'Chore added');
      }
      setIsChoreModalOpen(false);
    } catch (err) {
      console.error('Error saving chore:', err);
      alert('บันทึกงานบ้านไม่สำเร็จ');
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

  // Spin Mystery Box in Reward Shop
  const handleSpinGacha = async () => {
    if (!householdId || !currentUserId) return;
    if (myPoints < 10) {
      alert(language === 'th' ? 'คะแนนสะสมไม่พอ (ต้องใช้ 10 คะแนนในการสุ่ม)' : 'Not enough points (10 pts required)');
      return;
    }
    if (activeGachaSpin) {
      alert(language === 'th' ? 'คุณสุ่มกล่องปริศนาในสัปดาห์นี้ไปแล้ว! (สุ่มได้อีกครั้งในสัปดาห์หน้า)' : 'You already spun this week!');
      return;
    }

    setIsSpinningGacha(true);
    setSpinResult(null);

    try {
      const pool = chores.length > 0 
        ? chores.map((c) => ({ id: c.id, title: c.title })) 
        : [
            { id: null, title: 'กวาดบ้าน / ถูบ้าน' },
            { id: null, title: 'ล้างจาน' },
            { id: null, title: 'ซักผ้า / ตากผ้า' },
            { id: null, title: 'ล้างห้องน้ำ' },
            { id: null, title: 'เก็บขยะไปทิ้ง' },
            { id: null, title: 'ทำความสะอาดห้องครัว' },
          ];

      const pickedChore = pool[Math.floor(Math.random() * pool.length)];
      const multipliers = [1.5, 2, 2, 2, 2.5, 3, 5];
      const pickedMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];

      await new Promise((r) => setTimeout(r, 1500));

      const res = await spinChoreGacha({
        householdId,
        userId: currentUserId,
        choreId: pickedChore.id,
        choreTitle: pickedChore.title,
        multiplier: pickedMultiplier,
        pointsCost: 10,
      });

      if (res.success) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([80, 50, 120]);
        }
        setSpinResult({
          chore_title: pickedChore.title,
          multiplier: pickedMultiplier,
        });

        if (res.new_balance !== undefined) {
          setMyPoints(res.new_balance);
        }

        const active = await fetchMyActiveGachaSpin(currentUserId);
        setActiveGachaSpin(active);
        const hist = await fetchChoreGachaSpins(householdId);
        setGachaSpins(hist);

        // Refresh point logs
        fetchChorePointLogs(householdId).then(setPointLogs).catch(() => {});

        // Push notification to partner
        const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: '🎁 Bobbies Homie',
            body: language === 'th'
              ? `${senderName} สุ่มกล่องปริศนาได้งานบ้าน "${pickedChore.title}" รับโบนัสคะแนนคูณ x${pickedMultiplier}! 🌟`
              : `${senderName} spun the mystery box and got "${pickedChore.title}" with x${pickedMultiplier} pts! 🌟`,
            link: '/chores',
          }),
        }).catch(() => {});
      } else {
        if (res.error === 'already_spun_this_week') {
          alert(language === 'th' ? 'คุณสุ่มกล่องปริศนาในสัปดาห์นี้ไปแล้ว' : 'Already spun this week');
        } else if (res.error === 'insufficient_points') {
          alert(language === 'th' ? 'คะแนนของคุณไม่พอ (ต้องใช้ 10 คะแนน)' : 'Insufficient points');
        } else {
          alert(language === 'th' ? 'เกิดข้อผิดพลาดในการสุ่ม' : 'Failed to spin');
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Error spinning');
    } finally {
      setIsSpinningGacha(false);
    }
  };

  // --- Reward Management (Available from Manage tab only) ---

  const openCreateRewardModal = () => {
    setEditingReward(null);
    setRewardTitle('');
    setRewardDesc('');
    setRewardCost(25);
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

  // Propose New Reward or Propose Edit
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim() || !householdId || !currentUserId) return;
    setSavingReward(true);

    const needsApproval = members.length >= 2;
    const senderName =
      currentMember?.nickname ||
      currentMember?.full_name ||
      (language === 'th' ? 'คนในบ้าน' : 'Partner');

    try {
      if (editingReward) {
        if (needsApproval) {
          await proposeEditChoreReward(editingReward.id, currentUserId, {
            title: rewardTitle.trim(),
            description: rewardDesc.trim() || undefined,
            points_cost: rewardCost,
            icon: rewardIcon,
          });

          showToast(
            language === 'th'
              ? 'ส่งคำขอแก้ไขรางวัลแล้ว รอคนในบ้านอนุมัติ ✨'
              : 'Edit proposal sent. Waiting for partner approval ✨'
          );

          // Notify partner
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId,
              excludeUserId: currentUserId,
              title: '🎁 Bobbies Homie',
              body:
                language === 'th'
                  ? `${senderName} เสนอแก้ไขรางวัล '${editingReward.title}' กรุณาอนุมัติ! ✏️`
                  : `${senderName} proposed to edit reward '${editingReward.title}'. Please approve! ✏️`,
              link: '/chores',
            }),
          }).catch(() => {});
        } else {
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
        }
      } else {
        // Create new reward proposal
        await proposeCreateChoreReward(
          householdId,
          currentUserId,
          {
            title: rewardTitle.trim(),
            description: rewardDesc.trim() || undefined,
            points_cost: rewardCost,
            icon: rewardIcon,
          },
          needsApproval
        );

        showToast(
          needsApproval
            ? language === 'th'
              ? 'ส่งคำขอเพิ่มรางวัลแล้ว รอคนในบ้านอนุมัติ ✨'
              : 'Reward proposal sent. Waiting for partner approval ✨'
            : language === 'th'
            ? 'สร้างของรางวัลใหม่สำเร็จ'
            : 'Reward created'
        );

        if (needsApproval) {
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId,
              excludeUserId: currentUserId,
              title: '🎁 Bobbies Homie',
              body:
                language === 'th'
                  ? `${senderName} เสนอเพิ่มรางวัลใหม่: '${rewardTitle.trim()}' (${rewardCost} คะแนน) กรุณาอนุมัติ! ✨`
                  : `${senderName} proposed a new reward: '${rewardTitle.trim()}' (${rewardCost} pts). Please approve! ✨`,
              link: '/chores',
            }),
          }).catch(() => {});
        }
      }

      setIsRewardModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error saving reward:', err);
      alert('บันทึกของรางวัลไม่สำเร็จ');
    } finally {
      setSavingReward(false);
    }
  };

  // Propose Delete Reward (Two-person confirmation)
  const handleProposeDeleteReward = async (reward: DbChoreReward) => {
    if (!householdId || !currentUserId) return;
    const needsApproval = members.length >= 2;

    const confirmMsg = needsApproval
      ? language === 'th'
        ? `ต้องการส่งคำขอลบรางวัล '${reward.title}' ให้คนในบ้านยืนยันใช่หรือไม่?`
        : `Propose to delete '${reward.title}' for partner approval?`
      : language === 'th'
      ? `ต้องการลบรางวัล '${reward.title}' ใช่หรือไม่?`
      : `Delete reward '${reward.title}'?`;

    if (!confirm(confirmMsg)) return;

    try {
      if (needsApproval) {
        await proposeDeleteChoreReward(reward.id, currentUserId);
        showToast(
          language === 'th'
            ? 'ส่งคำขอลบรางวัลแล้ว รอคนในบ้านอนุมัติ'
            : 'Delete proposal sent. Waiting for partner approval'
        );

        const senderName =
          currentMember?.nickname ||
          currentMember?.full_name ||
          (language === 'th' ? 'คนในบ้าน' : 'Partner');
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: '🎁 Bobbies Homie',
            body:
              language === 'th'
                ? `${senderName} เสนอขอลบรางวัล '${reward.title}' กรุณาอนุมัติ 🗑️`
                : `${senderName} proposed to delete reward '${reward.title}'. Please approve 🗑️`,
            link: '/chores',
          }),
        }).catch(() => {});
      } else {
        await deleteChoreReward(reward.id);
        showToast(language === 'th' ? 'ลบของรางวัลเรียบร้อย' : 'Reward deleted');
      }
      loadData();
    } catch (err) {
      console.error('Error proposing delete reward:', err);
    }
  };

  // Cancel My Own Proposal
  const handleCancelProposal = async (reward: DbChoreReward) => {
    try {
      await cancelChoreRewardProposal(reward);
      showToast(language === 'th' ? 'ยกเลิกคำขอเรียบร้อยแล้ว' : 'Proposal cancelled');
      loadData();
    } catch (err) {
      console.error('Error cancelling proposal:', err);
    }
  };

  // Partner Approves or Rejects Reward Proposal (Create, Edit, Delete)
  const handleRespondProposal = async (reward: DbChoreReward, approved: boolean) => {
    if (!householdId) return;
    try {
      const res = await respondChoreRewardProposal(reward, approved);
      showToast(
        approved
          ? language === 'th'
            ? 'อนุมัติเรียบร้อยแล้ว! 🎉'
            : 'Approved successfully! 🎉'
          : language === 'th'
          ? 'ปฏิเสธคำขอเรียบร้อยแล้ว'
          : 'Proposal rejected'
      );

      // Notify partner
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
            ? `${approverName} อนุมัติของรางวัล '${reward.title}' เรียบร้อยแล้ว! ✨`
            : `${approverName} ปฏิเสธคำขอเกี่ยวกับรางวัล '${reward.title}'`,
          link: '/chores',
        }),
      }).catch(() => {});

      loadData();
    } catch (err) {
      console.error('Error responding to proposal:', err);
    }
  };

  // --- Redemptions ---

  // Request Reward Redemption from Shop
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

        loadData();
        // Switch to manage tab so user can see their pending redemption
        setActiveTab('manage');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to request redemption');
    } finally {
      setRedeeming(false);
    }
  };

  // Respond to Redemption (Approve / Reject) in Manage tab
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
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#5D4037] text-white text-[13px] font-semibold shadow-lg animate-in fade-in slide-in-from-top-3 flex items-center gap-2 max-w-[90%] text-center">
            <Sparkles className="w-4 h-4 text-[#F2C94C] shrink-0" />
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
        <div className="px-6 pt-2 pb-2">
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

        {/* ======================================================== */}
        {/* SLIDEBAR TAB NAVIGATION                                  */}
        {/* ======================================================== */}
        <div className="px-6 py-2 w-full">
          <div className="flex items-center gap-1.5 p-1.5 bg-[#F4EFEA] dark:bg-[#23201D] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[20px] overflow-x-auto no-scrollbar scroll-smooth">
            {/* Tab 1: งานบ้าน */}
            <button
              onClick={() => setActiveTab('tasks')}
              className={`shrink-0 px-3.5 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t.chores.tabTasks}</span>
              {choreStats.completed < choreStats.total && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#8D6E63]/15 text-[10px] font-bold">
                  {choreStats.total - choreStats.completed}
                </span>
              )}
            </button>

            {/* Tab 2: ร้านค้า (แลกรางวัลอย่างเดียว) */}
            <button
              onClick={() => setActiveTab('rewards')}
              className={`shrink-0 px-3.5 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'rewards'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{t.chores.tabRewards}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#5D4037]/10 dark:bg-[#DDD7D2]/10 text-[10px] font-bold">
                {activeShopRewards.length}
              </span>
            </button>

            {/* Tab 3: ประวัติคะแนน */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`shrink-0 px-3.5 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t.chores.tabLogs}</span>
            </button>

            {/* Tab 4: จัดการรางวัล (อยู่หลังประวัติคะแนนตามคำขอ) */}
            <button
              onClick={() => setActiveTab('manage')}
              className={`relative shrink-0 px-3.5 py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{t.chores.tabManageRewards || 'จัดการรางวัล'}</span>
              {totalPendingApprovalsForMe > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#E0533C] text-white text-[9px] font-extrabold flex items-center justify-center animate-pulse">
                  {totalPendingApprovalsForMe}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: CHORES TASKS                                      */}
        {/* ======================================================== */}
        {activeTab === 'tasks' && (
          <div className="px-6 pt-2 space-y-3">
            {/* Filter Pills and Add Button */}
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
                      {/* Left: Checkbox & Info */}
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

                      {/* Right: Points Badge */}
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-[10px] bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8]/60 dark:border-[#2E2A27] text-[11px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2]">
                          +{chore.points || 10} ⭐
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
        {/* TAB 2: REWARD SHOP (BROWSE & REDEEM ONLY)                */}
        {/* ======================================================== */}
        {activeTab === 'rewards' && (
          <div className="px-6 pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.tabRewards}
                </h2>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  ใช้คะแนนสะสมแลกของรางวัลที่ได้รับการอนุมัติแล้ว
                </p>
              </div>

              <button
                onClick={() => setActiveTab('manage')}
                className="px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-90 cursor-pointer"
              >
                <Settings2 className="w-3 h-3" />
                <span>จัดการรางวัล</span>
              </button>
            </div>

            {/* Subtle Weekly Mystery Box Card in Reward Shop */}
            <div className="p-3.5 rounded-[18px] bg-[#F8F5F0] dark:bg-[#231F1C] border border-[#D7CCC8]/80 dark:border-[#2E2A27] flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-[14px] bg-[#5D4037]/10 dark:bg-[#3E322A]/50 flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] shrink-0">
                  <Dice5 className="w-5 h-5 text-[#8D6E63] dark:text-[#BCAAA4]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                      {language === 'th' ? 'กล่องสุ่มงานบ้าน x ตัวคูณ' : 'Weekly Mystery Box'}
                    </h3>
                    <span className="text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87]">
                      10 pt
                    </span>
                  </div>
                  {activeGachaSpin ? (
                    <p className="text-[11px] text-[#2E7D32] dark:text-[#81C784] font-medium truncate mt-0.5">
                      🌟 {activeGachaSpin.chore_title} (x{activeGachaSpin.multiplier})
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate mt-0.5">
                      {language === 'th' ? 'สุ่มได้ 1 ครั้ง/สัปดาห์ ลุ้นคูณ x1.5-x5' : '1 spin/week • win x1.5-x5'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGachaHistoryModalOpen(true)}
                  title={language === 'th' ? 'ประวัติการสุ่ม' : 'History'}
                  className="p-2 rounded-[12px] bg-white dark:bg-[#2A2421] border border-[#D7CCC8]/70 dark:border-[#3E322A] text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsGachaModalOpen(true)}
                  className={`px-3 py-1.5 rounded-[12px] text-[12px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    activeGachaSpin
                      ? 'bg-[#E8F5E9] dark:bg-[#1B2E1D] text-[#2E7D32] dark:text-[#81C784] border border-[#2E7D32]/30'
                      : 'bg-[#5D4037] text-white hover:opacity-90 shadow-2xs'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeGachaSpin ? (language === 'th' ? 'ดูผลสุ่ม' : 'View') : (language === 'th' ? 'สุ่ม 10 pt' : 'Spin')}</span>
                </button>
              </div>
            </div>

            {activeShopRewards.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <Gift className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.noRewards}
                </p>
                <button
                  onClick={() => setActiveTab('manage')}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] hover:underline cursor-pointer"
                >
                  + ไปที่หน้าจัดการรางวัล
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {activeShopRewards.map((reward) => {
                  const IconComponent = getRewardIconComponent(reward.icon);
                  const canAfford = myPoints >= reward.points_cost;

                  return (
                    <div
                      key={reward.id}
                      className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 shadow-2xs"
                    >
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: POINT HISTORY & BALANCE SNAPSHOT                  */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="px-6 pt-2 space-y-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {t.chores.tabLogs}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                บันทึกประวัติคะแนน พร้อมแสดงคะแนนคงเหลือ ณ ขณะนั้น
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
                            •{' '}
                            {log.created_at
                              ? new Date(log.created_at).toLocaleDateString(
                                  language === 'th' ? 'th-TH' : 'en-US',
                                  {
                                    day: 'numeric',
                                    month: 'short',
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

                        {/* Snapshot Balance Display */}
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
        {/* TAB 4: MANAGE REWARDS & APPROVALS (AFTER POINT HISTORY)  */}
        {/* ======================================================== */}
        {activeTab === 'manage' && (
          <div className="px-6 pt-2 space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.tabManageRewards || 'จัดการรางวัล & อนุมัติ'}
                </h2>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  เพิ่ม แก้ไข หรือลบรางวัล โดยต้องได้รับการยืนยันจากทั้งสองคน
                </p>
              </div>

              <button
                onClick={openCreateRewardModal}
                className="px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรางวัล</span>
              </button>
            </div>

            {/* 1. APPROVALS QUEUE (Proposals & Redemptions) */}
            {(pendingRewardProposals.length > 0 || pendingRedemptions.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  <ShieldCheck className="w-4 h-4 text-[#E65100]" />
                  <span>คำขอที่รอการยืนยัน & อนุมัติ ({totalPendingApprovalsForMe})</span>
                </div>

                {/* 1.1 Reward Proposals (Create, Edit, Delete) */}
                {pendingRewardProposals.map((reward) => {
                  const isMyProposal = reward.proposed_by === currentUserId;
                  const proposerObj = members.find((m) => m.id === reward.proposed_by);
                  const proposerName =
                    proposerObj?.nickname ||
                    proposerObj?.full_name ||
                    (isMyProposal ? (language === 'th' ? 'ฉัน' : 'Me') : 'เพื่อนร่วมบ้าน');

                  const isPendingCreate = reward.status === 'pending_create';
                  const isPendingEdit = reward.status === 'pending_edit';
                  const isPendingDelete = reward.status === 'pending_delete';

                  return (
                    <div
                      key={reward.id}
                      className="p-4 bg-white dark:bg-[#201D1A] border-2 border-[#E65100]/30 rounded-[20px] space-y-3 shadow-xs"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>
                            {proposerName}{' '}
                            {isPendingCreate && 'เสนอเพิ่มรางวัลใหม่'}
                            {isPendingEdit && 'เสนอแก้ไขรางวัล'}
                            {isPendingDelete && 'เสนอขอลบรางวัล'}
                          </span>
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D]">
                          {isMyProposal ? 'รอคนในบ้านยืนยัน' : 'รอคุณอนุมัติ'}
                        </span>
                      </div>

                      {/* Content Comparison */}
                      <div className="py-1">
                        {isPendingCreate && (
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                                {reward.title}
                              </h3>
                              {reward.description && (
                                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                                  {reward.description}
                                </p>
                              )}
                            </div>
                            <span className="font-outfit font-extrabold text-[15px] text-[#E0533C]">
                              {reward.points_cost} คะแนน
                            </span>
                          </div>
                        )}

                        {isPendingEdit && (
                          <div className="space-y-1">
                            <div className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              เดิม: <span className="line-through">{reward.title}</span> ({reward.points_cost} คะแนน)
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-[14px] font-bold text-[#2E7D32] dark:text-[#81C784]">
                                  ใหม่: {reward.pending_payload?.title || reward.title}
                                </h3>
                                {reward.pending_payload?.description && (
                                  <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                                    {reward.pending_payload.description}
                                  </p>
                                )}
                              </div>
                              <span className="font-outfit font-extrabold text-[15px] text-[#E0533C]">
                                {reward.pending_payload?.points_cost ?? reward.points_cost} คะแนน
                              </span>
                            </div>
                          </div>
                        )}

                        {isPendingDelete && (
                          <div>
                            <h3 className="text-[14px] font-bold text-[#C62828]">
                              ขอลบรางวัล: &ldquo;{reward.title}&rdquo; ({reward.points_cost} คะแนน)
                            </h3>
                            <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              เมื่อทั้งสองคนอนุมัติ รางวัลนี้จะถูกลบออกจากร้านค้า
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions: Partner approves or Proposer cancels */}
                      <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] flex items-center gap-2">
                        {isMyProposal ? (
                          <button
                            onClick={() => handleCancelProposal(reward)}
                            className="w-full py-2 rounded-[12px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] text-[12px] font-bold hover:bg-[#D7CCC8]/50 transition-colors cursor-pointer"
                          >
                            ยกเลิกคำขอ
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRespondProposal(reward, false)}
                              className="flex-1 py-2 rounded-[12px] bg-[#F4EFEA] dark:bg-[#292522] text-[#C62828] text-[12px] font-bold hover:bg-[#FFEBEE] transition-colors cursor-pointer"
                            >
                              ปฏิเสธ
                            </button>
                            <button
                              onClick={() => handleRespondProposal(reward, true)}
                              className="flex-1 py-2 rounded-[12px] bg-[#2E7D32] text-white text-[12px] font-bold hover:bg-[#1B5E20] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>อนุมัติ</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 1.2 Redemption Requests */}
                {pendingRedemptions.map((red) => {
                  const isRequester = red.user_id === currentUserId;
                  const requesterName =
                    red.user?.nickname ||
                    red.user?.full_name ||
                    (isRequester ? (language === 'th' ? 'ฉัน' : 'Me') : 'เพื่อนร่วมบ้าน');

                  return (
                    <div
                      key={red.id}
                      className="p-4 bg-white dark:bg-[#201D1A] border-2 border-[#E65100]/30 rounded-[20px] space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5 text-[#E65100]" />
                          <span>{requesterName} ขอแลกรางวัล:</span>
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D]">
                          {isRequester ? 'รอคนในบ้านอนุมัติ' : 'รอคุณอนุมัติ'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <div>
                          <h3 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                            {red.reward_title}
                          </h3>
                          <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            {red.created_at
                              ? new Date(red.created_at).toLocaleDateString(
                                  language === 'th' ? 'th-TH' : 'en-US',
                                  { hour: '2-digit', minute: '2-digit' }
                                )
                              : ''}
                          </span>
                        </div>

                        <span className="font-outfit font-extrabold text-[16px] text-[#E0533C]">
                          -{red.points_spent} คะแนน
                        </span>
                      </div>

                      {!isRequester ? (
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
                      ) : (
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

            {/* 2. ACTIVE REWARDS LIST (With Edit & Delete options) */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                <span>ของรางวัลปัจจุบัน ({activeShopRewards.length})</span>
                <span className="text-[11px] text-[#8D6E63] font-normal">
                  กดเพื่อแก้ไขหรือส่งคำขอลบ
                </span>
              </div>

              {activeShopRewards.length === 0 ? (
                <div className="py-8 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-4">
                  <p className="text-[13px] text-[#8D6E63]">ยังไม่มีของรางวัลที่เปิดใช้งาน</p>
                </div>
              ) : (
                activeShopRewards.map((reward) => {
                  const IconComp = getRewardIconComponent(reward.icon);
                  return (
                    <SwipeableRow
                      key={reward.id}
                      onEdit={() => openEditRewardModal(reward)}
                      onDelete={() => handleProposeDeleteReward(reward)}
                      className="rounded-[18px]"
                    >
                      <div className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-[12px] bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-center shrink-0">
                            <IconComp className="w-5 h-5 text-[#5D4037] dark:text-[#DDD7D2]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                                {reward.title}
                              </h3>
                              <span className="px-1.5 py-0.2 rounded-full bg-[#2E7D32]/10 text-[#2E7D32] text-[10px] font-bold shrink-0">
                                ใช้งานอยู่
                              </span>
                            </div>
                            {reward.description && (
                              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate">
                                {reward.description}
                              </p>
                            )}
                            <span className="font-outfit font-extrabold text-[12px] text-[#E0533C] mt-0.5 block">
                              {reward.points_cost} {t.chores.pointsUnit}
                            </span>
                          </div>
                        </div>

                        {/* Explicit Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openEditRewardModal(reward)}
                            title="แก้ไขของรางวัล"
                            className="p-2 rounded-[10px] bg-[#F4EFEA] dark:bg-[#282421] text-[#5D4037] dark:text-[#DDD7D2] hover:bg-[#D7CCC8]/50 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleProposeDeleteReward(reward)}
                            title="ขอลบของรางวัล"
                            className="p-2 rounded-[10px] bg-[#FFEBEE] dark:bg-[#B71C1C]/20 text-[#C62828] hover:bg-[#FFCDD2] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </SwipeableRow>
                  );
                })
              )}
            </div>
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
        {/* MODAL 2: ADD / EDIT REWARD (PROPOSAL)                    */}
        {/* ======================================================== */}
        {isRewardModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-[390px] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] p-5 shadow-xl animate-in zoom-in-95 duration-200">
              <h2 className="text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                {editingReward ? 'เสนอแก้ไขของรางวัล' : 'เสนอเพิ่มของรางวัลใหม่'}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] mb-3">
                {members.length >= 2
                  ? 'ต้องได้รับการอนุมัติจากคนในบ้านทั้งสองคนก่อนใช้งานในร้านค้า'
                  : 'บันทึกของรางวัลเข้าสู่ร้านค้า'}
              </p>

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
                    <span>{editingReward ? 'ส่งคำขอแก้ไข' : 'ส่งคำขอเพิ่ม'}</span>
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

        {/* ======================================================== */}
        {/* MODAL: MYSTERY BOX SPIN MODAL                            */}
        {/* ======================================================== */}
        {isGachaModalOpen && (
          <div 
            onClick={() => setIsGachaModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          >
            <div 
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[370px] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border-2 border-[#D7CCC8] dark:border-[#3E322A] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-center relative overflow-hidden cursor-default"
            >
              <button
                onClick={() => setIsGachaModalOpen(false)}
                className="absolute top-3.5 right-3.5 p-1 rounded-full text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {spinResult ? (
                /* REVEAL RESULT */
                <div className="py-2 space-y-3">
                  <div className="w-16 h-16 rounded-[22px] bg-[#5D4037] text-[#F2C94C] flex items-center justify-center mx-auto shadow-md">
                    <Sparkles className="w-8 h-8" />
                  </div>

                  <div>
                    <span className="text-[12px] font-bold text-[#E65100] uppercase tracking-wider block">
                      ยินดีด้วย! คุณได้รับโบนัส
                    </span>
                    <h3 className="text-[20px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2] mt-1">
                      {spinResult.chore_title}
                    </h3>
                  </div>

                  <div className="p-4 rounded-[18px] bg-[#F8F5F0] dark:bg-[#2A231A] border border-[#D7CCC8]/80 text-center">
                    <span className="text-[12px] text-[#8D6E63] dark:text-[#948D87] block">
                      ตัวคูณคะแนนที่ได้รับ
                    </span>
                    <span className="font-outfit font-black text-[36px] leading-[40px] text-[#E65100] dark:text-[#FFB74D]">
                      x{spinResult.multiplier}
                    </span>
                    <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87] block mt-1">
                      ทำงานบ้านนี้ในสัปดาห์นี้เพื่อรับคะแนนคูณพิเศษทันที!
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsGachaModalOpen(false)}
                    className="w-full py-2.5 rounded-[14px] bg-[#5D4037] text-white text-[13px] font-bold hover:opacity-90 shadow-xs cursor-pointer"
                  >
                    รับทราบ & ลุยเลย!
                  </button>
                </div>
              ) : activeGachaSpin ? (
                /* ALREADY SPUN THIS WEEK */
                <div className="py-2 space-y-3">
                  <div className="w-14 h-14 rounded-[20px] bg-[#E8F5E9] dark:bg-[#1B5E20]/30 text-[#2E7D32] dark:text-[#81C784] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-[18px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2]">
                      สุ่มประจำสัปดาห์แล้ว!
                    </h3>
                    <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-1">
                      คุณใช้สิทธิ์สุ่ม 1 ครั้ง/สัปดาห์ไปแล้ว สามารถสุ่มใหม่อีกครั้งในสัปดาห์หน้า
                    </p>
                  </div>

                  <div className="p-3.5 rounded-[16px] bg-[#F4EFEA] dark:bg-[#282421] border border-[#D7CCC8] dark:border-[#2E2A27] text-left">
                    <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87] block">
                      โบนัสที่กำลังใช้งานอยู่:
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-[14px] text-[#5D4037] dark:text-[#DDD7D2]">
                        {activeGachaSpin.chore_title}
                      </span>
                      <span className="font-outfit font-extrabold text-[16px] text-[#E65100]">
                        x{activeGachaSpin.multiplier}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8D6E63] mt-1 block">
                      ใช้งานไปแล้ว {activeGachaSpin.times_used} ครั้ง
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsGachaModalOpen(false)}
                    className="w-full py-2.5 rounded-[14px] bg-[#5D4037] text-white text-[13px] font-bold hover:opacity-90 cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              ) : (
                /* READY TO SPIN */
                <div className="py-2 space-y-3">
                  <div className={`w-16 h-16 rounded-[22px] bg-[#5D4037] text-[#F2C94C] flex items-center justify-center mx-auto shadow-md ${isSpinningGacha ? 'animate-spin' : ''}`}>
                    <Dice5 className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-[18px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2]">
                      กล่องสุ่มงานบ้าน x คะแนนคูณ
                    </h3>
                    <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-1">
                      สุ่มเลือกงานบ้านที่จะได้รับโบนัสคูณคะแนนประจำสัปดาห์นี้
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8F5F0] dark:bg-[#282421] rounded-[16px] text-[12px] text-[#8D6E63] dark:text-[#948D87] space-y-1 text-left">
                    <div className="flex items-center justify-between">
                      <span>ใช้คะแนนสุ่ม:</span>
                      <span className="font-bold text-[#5D4037] dark:text-[#DDD7D2]">10 คะแนน</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>สิทธิ์การสุ่ม:</span>
                      <span className="font-bold text-[#2E7D32]">1 ครั้ง / สัปดาห์</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>โอกาสได้รับตัวคูณ:</span>
                      <span className="font-bold text-[#5D4037] dark:text-[#DDD7D2]">x1.5 ถึง x5 ⭐</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSpinningGacha || myPoints < 10}
                    onClick={handleSpinGacha}
                    className="w-full py-2.5 rounded-[14px] bg-[#5D4037] text-white text-[13px] font-extrabold shadow-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSpinningGacha ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังสุ่มรางวัล...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>เปิดกล่องปริศนา (10 คะแนน)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: GACHA HISTORY MODAL (ประวัติการสุ่ม)              */}
        {/* ======================================================== */}
        {isGachaHistoryModalOpen && (
          <div 
            onClick={() => setIsGachaHistoryModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          >
            <div 
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[390px] max-h-[80vh] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] p-5 shadow-2xl flex flex-col relative overflow-hidden cursor-default"
            >
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#5D4037] dark:text-[#DDD7D2]" />
                  <h3 className="text-[17px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2]">
                    ประวัติการสุ่มกล่องปริศนา
                  </h3>
                </div>
                <button
                  onClick={() => setIsGachaHistoryModalOpen(false)}
                  className="p-1 rounded-full text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto no-scrollbar space-y-2.5 flex-1 pr-1">
                {gachaSpins.length === 0 ? (
                  <div className="py-10 text-center text-[#8D6E63]">
                    <p className="text-[13px]">ยังไม่มีประวัติการสุ่มกล่องปริศนา</p>
                  </div>
                ) : (
                  gachaSpins.map((spin) => {
                    const spinUser = spin.user?.nickname || spin.user?.full_name || (spin.user_id === currentUserId ? 'ฉัน' : 'เพื่อนร่วมบ้าน');
                    return (
                      <div
                        key={spin.id}
                        className="p-3 rounded-[16px] bg-white dark:bg-[#141312] border border-[#D7CCC8]/70 dark:border-[#2E2A27] flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5 text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            <span className="font-bold">{spinUser}</span>
                            <span>•</span>
                            <span>{spin.week_identifier}</span>
                          </div>
                          <h4 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                            {spin.chore_title}
                          </h4>
                          <span className="text-[10px] text-[#8D6E63] dark:text-[#948D87] block mt-0.5">
                            ใช้งานแล้ว {spin.times_used} ครั้ง {spin.is_active && '• กำลังใช้งานอยู่'}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-outfit font-black text-[18px] text-[#E65100]">
                            x{spin.multiplier}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsGachaHistoryModalOpen(false)}
                className="mt-3.5 w-full py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#282421] text-[#8D6E63] dark:text-[#948D87] text-[12px] font-bold hover:bg-[#D7CCC8]/50 transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
