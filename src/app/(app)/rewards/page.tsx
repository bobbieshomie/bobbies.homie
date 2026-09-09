'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  History,
  Users,
  User,
  Heart,
  Coffee,
  Utensils,
  Smile,
  Star,
  ShoppingBag,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Dice5,
  ArrowRight,
  CheckSquare,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchChores,
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
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type RewardTab = 'shop' | 'logs' | 'manage';

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

function RewardsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();
  const profile = useAppStore((state) => state.profile);

  // Core Data
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [myPoints, setMyPoints] = useState<number>(0);

  const [chores, setChores] = useState<DbChore[]>([]);
  const [rewards, setRewards] = useState<DbChoreReward[]>([]);
  const [redemptions, setRedemptions] = useState<DbRewardRedemption[]>([]);
  const [pointLogs, setPointLogs] = useState<DbChorePointLog[]>([]);

  // Navigation tab from URL if present
  const initialTab = (searchParams.get('tab') as RewardTab) || 'shop';
  const [activeTab, setActiveTab] = useState<RewardTab>(
    ['shop', 'logs', 'manage'].includes(initialTab) ? initialTab : 'shop'
  );

  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userProfile?.household_id) {
        const hId = userProfile.household_id;
        setHouseholdId(hId);
        setMyPoints(userProfile.chore_points || 0);

        const [
          choresRes,
          rewardsRes,
          redemptionsRes,
          pointLogsRes,
          membersRes,
          activeSpinRes,
          gachaSpinsRes,
        ] = await Promise.all([
          fetchChores(hId),
          fetchChoreRewards(hId),
          fetchRewardRedemptions(hId),
          fetchChorePointLogs(hId),
          fetchHouseholdMembers(hId),
          fetchMyActiveGachaSpin(user.id),
          fetchChoreGachaSpins(hId),
        ]);

        setChores(choresRes);
        setRewards(rewardsRes);
        setRedemptions(redemptionsRes);
        setPointLogs(pointLogsRes);
        setMembers(membersRes);
        setActiveGachaSpin(activeSpinRes);
        setGachaSpins(gachaSpinsRes);
      }
    } catch (err) {
      console.error('Failed to load rewards data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Partner member info
  const partnerMember = useMemo(() => {
    return members.find((m) => m.id !== currentUserId);
  }, [members, currentUserId]);

  // Current user member info
  const currentMember = useMemo(() => {
    return members.find((m) => m.id === currentUserId);
  }, [members, currentUserId]);

  // Approved Rewards for Shop (only active)
  const activeShopRewards = useMemo(() => {
    return rewards.filter((r) => !r.status || r.status === 'active');
  }, [rewards]);

  // Pending Reward Proposals (waiting for second person)
  const pendingRewardProposals = useMemo(() => {
    return rewards.filter(
      (r) => r.status && ['pending_create', 'pending_edit', 'pending_delete'].includes(r.status)
    );
  }, [rewards]);

  // Pending Redemptions
  const pendingRedemptions = useMemo(() => {
    return redemptions.filter((r) => r.status === 'pending');
  }, [redemptions]);

  // Total pending approvals requiring action
  const totalPendingApprovalsForMe = useMemo(() => {
    const proposalsForMe = pendingRewardProposals.filter(
      (r) => r.proposed_by !== currentUserId
    ).length;
    const redemptionsForMe = pendingRedemptions.filter(
      (r) => r.user_id !== currentUserId
    ).length;
    return proposalsForMe + redemptionsForMe;
  }, [pendingRewardProposals, pendingRedemptions, currentUserId]);

  // Separate Reward Redemptions Log (แลกอะไรไป, วันที่เท่าไหร่, กี่คะแนน, ใครแลก)
  const rewardLogs = useMemo(() => {
    return redemptions.map((red) => {
      const isMyRedemption = red.user_id === currentUserId;
      const userName =
        red.user?.nickname ||
        red.user?.full_name ||
        (isMyRedemption ? (language === 'th' ? 'ฉัน' : 'Me') : 'เพื่อนร่วมบ้าน');

      const matchingReward = rewards.find((r) => r.id === red.reward_id);

      return {
        id: red.id,
        rewardTitle: red.reward_title || 'ของรางวัล',
        rewardIcon: matchingReward?.icon || 'Gift',
        userName,
        isMe: isMyRedemption,
        pointsSpent: red.points_spent,
        status: red.status, // 'pending' | 'approved' | 'rejected'
        createdAt: red.created_at,
      };
    });
  }, [redemptions, rewards, currentUserId, language]);

  // Handle Mystery Box Gacha Spin
  const handleSpinGacha = async () => {
    if (!currentUserId || !householdId) return;
    if (myPoints < 10) {
      alert(language === 'th' ? 'คะแนนของคุณไม่พอ (ต้องใช้ 10 คะแนน)' : 'Insufficient points (10 pts required)');
      return;
    }
    if (chores.length === 0) {
      alert(language === 'th' ? 'ยังไม่มีงานบ้านในระบบให้สุ่ม' : 'No chores available to spin');
      return;
    }

    try {
      setIsSpinningGacha(true);
      const pickedChore = chores[Math.floor(Math.random() * chores.length)];
      const multipliers = [2, 2, 2, 3, 3, 5];
      const pickedMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];

      const res = await spinChoreGacha({
        householdId,
        userId: currentUserId,
        choreId: pickedChore.id,
        choreTitle: pickedChore.title,
        multiplier: pickedMultiplier,
        pointsCost: 10,
      });

      if (res.success) {
        setSpinResult({
          chore_title: res.chore_title || pickedChore.title,
          multiplier: res.multiplier || pickedMultiplier,
        });
        setMyPoints((prev) => Math.max(0, prev - 10));
        setIsGachaModalOpen(true);
        loadData();

        // Push notification
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
            link: '/rewards',
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

  // Open Create Reward Modal
  const openCreateRewardModal = () => {
    setEditingReward(null);
    setRewardTitle('');
    setRewardDesc('');
    setRewardCost(50);
    setRewardIcon('Gift');
    setIsRewardModalOpen(true);
  };

  // Open Edit Reward Modal
  const openEditRewardModal = (r: DbChoreReward) => {
    setEditingReward(r);
    setRewardTitle(r.title);
    setRewardDesc(r.description || '');
    setRewardCost(r.points_cost);
    setRewardIcon(r.icon || 'Gift');
    setIsRewardModalOpen(true);
  };

  // Propose Save Reward
  const handleSaveRewardProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !currentUserId || !rewardTitle.trim()) return;

    try {
      setSavingReward(true);
      const isSolo = members.length <= 1;

      if (!editingReward) {
        if (isSolo) {
          await createChoreReward(householdId, currentUserId, {
            title: rewardTitle.trim(),
            description: rewardDesc.trim() || undefined,
            points_cost: rewardCost,
            icon: rewardIcon,
          });
          showToast(language === 'th' ? 'เพิ่มของรางวัลเรียบร้อยแล้ว' : 'Reward created');
        } else {
          await proposeCreateChoreReward(
            householdId,
            currentUserId,
            {
              title: rewardTitle.trim(),
              description: rewardDesc.trim() || undefined,
              points_cost: rewardCost,
              icon: rewardIcon,
            },
            true
          );
          showToast(language === 'th' ? 'ส่งคำขอเพิ่มรางวัลแล้ว รอคนในบ้านอนุมัติ' : 'Proposal sent');

          const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId,
              excludeUserId: currentUserId,
              title: '🎁 Bobbies Homie',
              body: language === 'th'
                ? `${senderName} เสนอเพิ่มรางวัลใหม่ "${rewardTitle.trim()}" รอคุณอนุมัติ`
                : `${senderName} proposed new reward "${rewardTitle.trim()}"`,
              link: '/rewards?tab=manage',
            }),
          }).catch(() => {});
        }
      } else {
        if (isSolo) {
          await updateChoreReward(editingReward.id, {
            title: rewardTitle.trim(),
            description: rewardDesc.trim() || null,
            points_cost: rewardCost,
            icon: rewardIcon,
          });
          showToast(language === 'th' ? 'แก้ไขรางวัลเรียบร้อยแล้ว' : 'Reward updated');
        } else {
          await proposeEditChoreReward(editingReward.id, currentUserId, {
            title: rewardTitle.trim(),
            description: rewardDesc.trim() || undefined,
            points_cost: rewardCost,
            icon: rewardIcon,
          });
          showToast(language === 'th' ? 'ส่งคำขอแก้ไขรางวัลแล้ว รอคนในบ้านอนุมัติ' : 'Edit proposal sent');

          const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId,
              excludeUserId: currentUserId,
              title: '🎁 Bobbies Homie',
              body: language === 'th'
                ? `${senderName} เสนอแก้ไขรางวัล "${rewardTitle.trim()}" รอคุณอนุมัติ`
                : `${senderName} proposed editing "${rewardTitle.trim()}"`,
              link: '/rewards?tab=manage',
            }),
          }).catch(() => {});
        }
      }

      setIsRewardModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to save reward proposal');
    } finally {
      setSavingReward(false);
    }
  };

  // Propose Delete Reward
  const handleDeleteRewardProposal = async (reward: DbChoreReward) => {
    if (!currentUserId) return;
    const isSolo = members.length <= 1;

    if (isSolo) {
      if (!confirm(language === 'th' ? 'ยืนยันที่จะลบของรางวัลนี้?' : 'Delete this reward?')) return;
      try {
        await deleteChoreReward(reward.id);
        showToast(language === 'th' ? 'ลบของรางวัลเรียบร้อยแล้ว' : 'Reward deleted');
        await loadData();
      } catch (err: any) {
        alert(err?.message || 'Failed to delete');
      }
    } else {
      if (
        !confirm(
          language === 'th'
            ? `ขอลบรางวัล "${reward.title}" ใช่ไหม? (ระบบจะส่งคำขอไปยังคนในบ้านเพื่อยืนยัน)`
            : `Propose deleting "${reward.title}"? Partner confirmation required.`
        )
      ) {
        return;
      }
      try {
        await proposeDeleteChoreReward(reward.id, currentUserId);
        showToast(language === 'th' ? 'ส่งคำขอลบรางวัลแล้ว รอคนในบ้านอนุมัติ' : 'Delete proposal sent');

        const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: '🎁 Bobbies Homie',
            body: language === 'th'
              ? `${senderName} ขอลบรางวัล "${reward.title}" รอคุณยืนยัน`
              : `${senderName} proposed deleting "${reward.title}"`,
            link: '/rewards?tab=manage',
          }),
        }).catch(() => {});

        await loadData();
      } catch (err: any) {
        alert(err?.message || 'Failed to propose delete');
      }
    }
  };

  // Cancel Proposal (Proposer only)
  const handleCancelProposal = async (reward: DbChoreReward) => {
    try {
      await cancelChoreRewardProposal(reward);
      showToast(language === 'th' ? 'ยกเลิกคำขอแล้ว' : 'Proposal cancelled');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel');
    }
  };

  // Respond to Proposal (Partner approves or rejects)
  const handleRespondProposal = async (reward: DbChoreReward, approve: boolean) => {
    try {
      await respondChoreRewardProposal(reward, approve);
      showToast(
        approve
          ? language === 'th'
            ? 'อนุมัติการเปลี่ยนแปลงรางวัลเรียบร้อย'
            : 'Proposal approved'
          : language === 'th'
          ? 'ปฏิเสธคำขอเรียบร้อย'
          : 'Proposal rejected'
      );

      const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          excludeUserId: currentUserId,
          title: '🎁 Bobbies Homie',
          body: language === 'th'
            ? `${senderName} ${approve ? 'อนุมัติ' : 'ปฏิเสธ'} คำขอเกี่ยวกับรางวัล "${reward.title}" แล้ว`
            : `${senderName} ${approve ? 'approved' : 'rejected'} proposal for "${reward.title}"`,
          link: '/rewards',
        }),
      }).catch(() => {});

      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to respond');
    }
  };

  // Request Reward Redemption
  const handleRequestRedemption = async () => {
    if (!redeemConfirmItem || !currentUserId || !householdId) return;

    if (myPoints < redeemConfirmItem.points_cost) {
      alert(t.chores.insufficientPoints);
      return;
    }

    try {
      setRedeeming(true);
      const isSolo = members.length <= 1;

      const res = await requestRewardRedemption(redeemConfirmItem.id);

      if (res.success) {
        showToast(
          isSolo
            ? language === 'th'
              ? 'แลกของรางวัลสำเร็จแล้ว!'
              : 'Reward redeemed!'
            : language === 'th'
            ? 'ส่งคำขอแลกรางวัลแล้ว รอคนในบ้านอนุมัติ'
            : 'Redemption requested!'
        );

        if (!isSolo) {
          const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId,
              excludeUserId: currentUserId,
              title: '🎁 Bobbies Homie',
              body: language === 'th'
                ? `${senderName} ขอแลกของรางวัล "${redeemConfirmItem.title}" (${redeemConfirmItem.points_cost} คะแนน) รอคุณอนุมัติ`
                : `${senderName} requested "${redeemConfirmItem.title}" (${redeemConfirmItem.points_cost} pts)`,
              link: '/rewards?tab=manage',
            }),
          }).catch(() => {});
        }

        setRedeemConfirmItem(null);
        await loadData();
      }
    } catch (err: any) {
      alert(err?.message || 'Error redeeming');
    } finally {
      setRedeeming(false);
    }
  };

  // Respond to Redemption (Partner approves or rejects)
  const handleRespondRedemption = async (redemption: DbRewardRedemption, approve: boolean) => {
    try {
      const res = await respondRewardRedemption(redemption.id, approve);
      if (res.success) {
        showToast(
          approve
            ? language === 'th'
              ? 'อนุมัติการแลกรางวัลเรียบร้อย'
              : 'Redemption approved'
            : language === 'th'
            ? 'ปฏิเสธและคืนคะแนนเรียบร้อย'
            : 'Redemption rejected'
        );

        const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: '🎁 Bobbies Homie',
            body: language === 'th'
              ? `${senderName} ${approve ? 'อนุมัติ' : 'ปฏิเสธ'} คำขอแลกของรางวัลของคุณแล้ว`
              : `${senderName} ${approve ? 'approved' : 'rejected'} your redemption request`,
            link: '/rewards?tab=logs',
          }),
        }).catch(() => {});

        await loadData();
      }
    } catch (err: any) {
      alert(err?.message || 'Error responding to redemption');
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
                <Gift className="w-5 h-5 text-[#E0533C]" />
                <span>{language === 'th' ? 'ร้านค้า & รางวัล' : 'Rewards & Shop'}</span>
              </h1>
              <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th' ? 'ใช้คะแนนสะสมแลกรางวัล หรือจัดการของรางวัล' : 'Redeem rewards and manage approvals'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Link to Chores page */}
            <Link
              href="/chores"
              className="px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-80 transition-colors shadow-2xs"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#2E7D32]" />
              <span>{language === 'th' ? 'งานบ้าน' : 'Chores'}</span>
            </Link>

            <NotificationBell />
          </div>
        </div>

        {/* ======================================================== */}
        {/* PROMINENT POINTS BALANCE CARD (THIS IS THE REWARD HUB)   */}
        {/* ======================================================== */}
        <div className="px-6 mb-3">
          <div className="p-4 bg-gradient-to-br from-[#FFF9F5] to-[#F4EFEA] dark:from-[#25221F] dark:to-[#1F1D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.06)]">
            <div className="flex items-center justify-between">
              {/* My Points */}
              <div className="flex-1">
                <span className="text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-[#F2C94C]" />
                  <span>{t.chores.myPoints}</span>
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-outfit font-extrabold text-[26px] text-[#5D4037] dark:text-[#DDD7D2]">
                    {myPoints}
                  </span>
                  <span className="text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87]">
                    {t.chores.pointsUnit}
                  </span>
                </div>
              </div>

              {/* Partner Points */}
              {partnerMember && (
                <div className="text-right border-l border-[#D7CCC8]/60 dark:border-[#2E2A27] pl-4">
                  <span className="text-[11px] font-medium text-[#8D6E63] dark:text-[#948D87] block">
                    {partnerMember.nickname || partnerMember.full_name}
                  </span>
                  <div className="flex items-baseline justify-end gap-1 mt-0.5">
                    <span className="font-outfit font-bold text-[20px] text-[#5D4037]/80 dark:text-[#DDD7D2]/80">
                      {partnerMember.chore_points || 0}
                    </span>
                    <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      {t.chores.pointsUnit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SLIDEBAR TAB NAVIGATION                                  */}
        {/* ======================================================== */}
        <div className="px-6 py-1 w-full mb-2">
          <div className="flex items-center gap-1.5 p-1.5 bg-[#F4EFEA] dark:bg-[#23201D] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[20px] overflow-x-auto no-scrollbar scroll-smooth">
            {/* Tab 1: ร้านค้า */}
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex-1 min-w-[90px] py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'shop'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ร้านค้า' : 'Shop'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#5D4037]/10 dark:bg-[#DDD7D2]/10 text-[10px] font-bold">
                {activeShopRewards.length}
              </span>
            </button>

            {/* Tab 2: ประวัติการแลกรางวัล */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 min-w-[110px] py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ประวัติการแลก' : 'Redemptions'}</span>
            </button>

            {/* Tab 3: จัดการรางวัล & อนุมัติ 2 คน */}
            <button
              onClick={() => setActiveTab('manage')}
              className={`relative flex-1 min-w-[100px] py-2 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'จัดการรางวัล' : 'Manage'}</span>
              {totalPendingApprovalsForMe > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#E0533C] text-white text-[9px] font-extrabold flex items-center justify-center animate-pulse">
                  {totalPendingApprovalsForMe}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: REWARD SHOP (BROWSE & REDEEM + GACHA)             */}
        {/* ======================================================== */}
        {activeTab === 'shop' && (
          <div className="px-6 pt-2 space-y-3">
            {/* Subtle Weekly Mystery Box Gacha Card */}
            <div className="p-3.5 bg-[#FAF7F2] dark:bg-[#201D1A] border border-[#E0D7D0] dark:border-[#2E2A27] rounded-[20px] flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[12px] bg-[#5D4037]/10 dark:bg-[#DDD7D2]/10 flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] shrink-0">
                  <Dice5 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                      {language === 'th' ? 'กล่องสุ่มงานบ้าน' : 'Mystery Box'}
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E0533C]/10 text-[#E0533C] font-extrabold">
                      {language === 'th' ? 'สัปดาห์ละ 1 ครั้ง' : '1x / week'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate">
                    {activeGachaSpin
                      ? language === 'th'
                        ? `งาน "${activeGachaSpin.chore_title}" โบนัส x${activeGachaSpin.multiplier}`
                        : `Task "${activeGachaSpin.chore_title}" bonus x${activeGachaSpin.multiplier}`
                      : language === 'th'
                      ? 'ใช้ 10 คะแนน สุ่มรับงานบ้านโบนัสคูณ x2 - x5'
                      : 'Cost 10 pts to get a chore bonus multiplier'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeGachaSpin ? (
                  <button
                    onClick={() => setIsGachaHistoryModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-[10px] bg-[#E8F5E9] dark:bg-[#1B5E20]/30 text-[#2E7D32] dark:text-[#81C784] text-[11px] font-bold cursor-pointer hover:opacity-90"
                  >
                    x{activeGachaSpin.multiplier}
                  </button>
                ) : (
                  <button
                    onClick={handleSpinGacha}
                    disabled={isSpinningGacha || myPoints < 10}
                    className={`px-3 py-1.5 rounded-[12px] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      myPoints >= 10
                        ? 'bg-[#5D4037] text-white hover:opacity-90 shadow-2xs'
                        : 'bg-[#D7CCC8]/50 text-[#8D6E63] cursor-not-allowed'
                    }`}
                  >
                    {isSpinningGacha ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Dice5 className="w-3.5 h-3.5" />
                        <span>{language === 'th' ? 'สุ่ม 10 pt' : 'Spin 10 pt'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Shop Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.tabRewards}
                </h2>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  {language === 'th' ? 'ใช้คะแนนสะสมแลกรางวัลที่อนุมัติแล้ว' : 'Redeem approved household rewards'}
                </p>
              </div>

              <button
                onClick={() => setActiveTab('manage')}
                className="px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-90 cursor-pointer"
              >
                <Settings2 className="w-3 h-3" />
                <span>{language === 'th' ? 'จัดการรางวัล' : 'Manage'}</span>
              </button>
            </div>

            {/* Rewards Cards Grid */}
            {loading ? (
              <div className="py-12 flex justify-center text-[#8D6E63]">
                <Loader2 className="w-6 h-6 animate-spin text-[#5D4037]" />
              </div>
            ) : activeShopRewards.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <Gift className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.noRewards}
                </p>
                <button
                  onClick={() => {
                    setActiveTab('manage');
                    openCreateRewardModal();
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[#E0533C] hover:underline cursor-pointer"
                >
                  + {language === 'th' ? 'เสนอเพิ่มรางวัลใหม่' : 'Propose new reward'}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeShopRewards.map((reward) => {
                  const IconComponent = getRewardIconComponent(reward.icon);
                  const canAfford = myPoints >= reward.points_cost;

                  return (
                    <div
                      key={reward.id}
                      className="p-4 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[20px] flex items-center justify-between gap-3 shadow-2xs transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-[14px] bg-[#FFF3E0] dark:bg-[#2B231D] flex items-center justify-center text-[#E65100] shrink-0">
                          <IconComponent className="w-5 h-5" />
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
                            <span className="font-outfit font-extrabold text-[14px] text-[#E0533C]">
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
        {/* TAB 2: REWARD REDEMPTION LOG (แลกอะไรไป, วันที่, กี่คะแนน) */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="px-6 pt-2 space-y-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'ประวัติการแลกของรางวัล' : 'Reward Redemption Log'}
              </h2>
              <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th' ? 'แสดงรายการของรางวัลที่แลก วันที่ และคะแนนที่ใช้' : 'History of redeemed rewards, dates, and points cost'}
              </p>
            </div>

            {rewardLogs.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <History className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'ยังไม่มีประวัติการแลกของรางวัล' : 'No reward redemptions yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {rewardLogs.map((log) => {
                  const IconComponent = getRewardIconComponent(log.rewardIcon);

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-[12px] bg-[#FFF3E0] dark:bg-[#2B231D] flex items-center justify-center text-[#E65100] shrink-0">
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87]">
                              {log.userName}
                            </span>
                            <span className="text-[10px] text-[#8D6E63]/60 dark:text-[#948D87]/60">
                              •{' '}
                              {log.createdAt
                                ? new Date(log.createdAt).toLocaleDateString(
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
                            {log.rewardTitle}
                          </h4>

                          {/* Status Badge */}
                          <div className="mt-1">
                            {log.status === 'pending' && (
                              <span className="inline-block text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#FFF3E0] text-[#E65100]">
                                {language === 'th' ? 'รออนุมัติ' : 'Pending'}
                              </span>
                            )}
                            {log.status === 'approved' && (
                              <span className="inline-block text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                                {language === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
                              </span>
                            )}
                            {log.status === 'rejected' && (
                              <span className="inline-block text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#FFEBEE] text-[#C62828]">
                                {language === 'th' ? 'ปฏิเสธ (คืนแต้ม)' : 'Rejected'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Points Cost (-XX pt) */}
                      <div className="text-right shrink-0">
                        <span className="font-outfit font-extrabold text-[16px] text-[#E0533C]">
                          -{log.pointsSpent}
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
        {/* TAB 3: MANAGE REWARDS & APPROVALS (TWO-PERSON PROPOSALS) */}
        {/* ======================================================== */}
        {activeTab === 'manage' && (
          <div className="px-6 pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'จัดการของรางวัล & อนุมัติ' : 'Manage Rewards & Approvals'}
                </h2>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  {language === 'th' ? 'เพิ่ม แก้ไข หรือลบรางวัล ต้องได้รับการยืนยันจากทั้งสองคน' : 'Propose reward changes with two-person confirmation'}
                </p>
              </div>

              <button
                onClick={openCreateRewardModal}
                className="px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'เพิ่มรางวัล' : 'Add Reward'}</span>
              </button>
            </div>

            {/* Approvals Queue */}
            {(pendingRewardProposals.length > 0 || pendingRedemptions.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  <ShieldCheck className="w-4 h-4 text-[#E65100]" />
                  <span>{language === 'th' ? `คำขอที่รอการยืนยัน & อนุมัติ (${totalPendingApprovalsForMe})` : `Pending Approvals (${totalPendingApprovalsForMe})`}</span>
                </div>

                {/* Proposals */}
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
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>
                            {proposerName}{' '}
                            {isPendingCreate && (language === 'th' ? 'เสนอเพิ่มรางวัลใหม่' : 'proposed new reward')}
                            {isPendingEdit && (language === 'th' ? 'เสนอแก้ไขรางวัล' : 'proposed editing reward')}
                            {isPendingDelete && (language === 'th' ? 'เสนอขอลบรางวัล' : 'proposed deleting reward')}
                          </span>
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D]">
                          {isMyProposal
                            ? language === 'th'
                              ? 'รอคนในบ้านยืนยัน'
                              : 'Waiting partner'
                            : language === 'th'
                            ? 'รอคุณอนุมัติ'
                            : 'Waiting your approval'}
                        </span>
                      </div>

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
                              {reward.points_cost} {t.chores.pointsUnit}
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
                                {reward.pending_payload?.points_cost ?? reward.points_cost} {t.chores.pointsUnit}
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

                {/* Redemptions queue */}
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
                          {isRequester
                            ? language === 'th'
                              ? 'รอคนในบ้านอนุมัติ'
                              : 'Waiting partner'
                            : language === 'th'
                            ? 'รอคุณอนุมัติ'
                            : 'Waiting your approval'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <div>
                          <h3 className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                            {red.reward_title || 'ของรางวัล'}
                          </h3>
                          <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            {red.created_at
                              ? new Date(red.created_at).toLocaleDateString(
                                  language === 'th' ? 'th-TH' : 'en-US',
                                  {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )
                              : ''}
                          </p>
                        </div>
                        <span className="font-outfit font-extrabold text-[15px] text-[#E0533C]">
                          -{red.points_spent} {t.chores.pointsUnit}
                        </span>
                      </div>

                      {!isRequester && (
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
                    </div>
                  );
                })}
              </div>
            )}

            {/* Approved Rewards Management List */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? `รางวัลทั้งหมดในร้านค้า (${activeShopRewards.length})` : `All Store Rewards (${activeShopRewards.length})`}
              </h3>

              {activeShopRewards.map((reward) => {
                const IconComponent = getRewardIconComponent(reward.icon);
                return (
                  <div
                    key={reward.id}
                    className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-[12px] bg-[#FFF3E0] dark:bg-[#2B231D] flex items-center justify-center text-[#E65100] shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                          {reward.title}
                        </h4>
                        <span className="font-outfit font-extrabold text-[12px] text-[#E0533C]">
                          {reward.points_cost} {t.chores.pointsUnit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditRewardModal(reward)}
                        className="p-2 rounded-[10px] text-[#8D6E63] hover:bg-[#F4EFEA] dark:hover:bg-[#292522] cursor-pointer"
                        title={t.chores.editReward}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRewardProposal(reward)}
                        className="p-2 rounded-[10px] text-[#C62828] hover:bg-[#FFEBEE] dark:hover:bg-[#3D1E1E] cursor-pointer"
                        title={t.chores.deleteReward}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: CREATE / EDIT REWARD (PROPOSAL)                   */}
        {/* ======================================================== */}
        {isRewardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up">
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {editingReward ? t.chores.editReward : t.chores.createReward}
                </h3>
                <button
                  onClick={() => setIsRewardModalOpen(false)}
                  className="p-1 rounded-full text-[#8D6E63] hover:bg-[#D7CCC8]/30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRewardProposal} className="p-6 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.rewardTitle}
                  </label>
                  <input
                    type="text"
                    required
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder={t.chores.rewardTitlePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.rewardDesc}
                  </label>
                  <input
                    type="text"
                    value={rewardDesc}
                    onChange={(e) => setRewardDesc(e.target.value)}
                    placeholder="เช่น ร้านประจำแถวบ้าน, ไม่เกิน 200 บ."
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.pointsCost}
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    required
                    value={rewardCost}
                    onChange={(e) => setRewardCost(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] font-outfit font-bold focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1.5">
                    ไอคอน
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {REWARD_ICONS.map((item) => {
                      const Icon = item.icon;
                      const isSelected = rewardIcon === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRewardIcon(item.id)}
                          className={`p-2.5 rounded-[12px] flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#5D4037] text-white border-[#5D4037]'
                              : 'bg-white dark:bg-[#2A2724] text-[#8D6E63] border-[#D7CCC8] dark:border-[#3D3835]'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[10px] font-medium truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRewardModalOpen(false)}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] text-[13px] font-bold cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingReward}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    {savingReward ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>{language === 'th' ? 'ส่งคำขอเสนอ' : 'Submit'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: REDEEM CONFIRMATION                               */}
        {/* ======================================================== */}
        {redeemConfirmItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl p-6 text-center animate-scale-up space-y-4">
              <div className="w-14 h-14 rounded-[20px] bg-[#FFF3E0] dark:bg-[#2B231D] text-[#E65100] flex items-center justify-center mx-auto">
                <Gift className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-[17px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.redeemConfirmTitle}
                </h3>
                <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-1">
                  {t.chores.redeemConfirmDesc}
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-[#2A2724] rounded-[18px] border border-[#D7CCC8]/60 dark:border-[#3D3835] text-left">
                <div className="text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {redeemConfirmItem.title}
                </div>
                {redeemConfirmItem.description && (
                  <div className="text-[11px] text-[#8D6E63] dark:text-[#948D87] mt-0.5">
                    {redeemConfirmItem.description}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-[#D7CCC8]/40 dark:border-[#3D3835] flex items-center justify-between text-[12px]">
                  <span className="text-[#8D6E63] dark:text-[#948D87]">{t.chores.cost}:</span>
                  <span className="font-outfit font-extrabold text-[15px] text-[#E0533C]">
                    {redeemConfirmItem.points_cost} {t.chores.pointsUnit}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRedeemConfirmItem(null)}
                  className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] text-[13px] font-bold cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleRequestRedemption}
                  disabled={redeeming}
                  className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {redeeming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{t.chores.redeem}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: GACHA SPIN RESULT                                 */}
        {/* ======================================================== */}
        {isGachaModalOpen && spinResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl p-6 text-center animate-scale-up space-y-4">
              <div className="w-16 h-16 rounded-[22px] bg-[#FFF3E0] text-[#E65100] flex items-center justify-center mx-auto animate-bounce">
                <Dice5 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#E0533C]/10 text-[#E0533C]">
                  {language === 'th' ? 'ผลการสุ่มกล่องปริศนา!' : 'Mystery Box Result!'}
                </span>
                <h3 className="text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mt-2">
                  {spinResult.chore_title}
                </h3>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-[13px] text-[#8D6E63] dark:text-[#948D87]">
                    {language === 'th' ? 'โบนัสคะแนนคูณ:' : 'Points Multiplier:'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] font-outfit font-extrabold text-[20px]">
                    x{spinResult.multiplier}
                  </span>
                </div>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] mt-2">
                  {language === 'th'
                    ? 'เมื่อทำงานบ้านนี้เสร็จ คะแนนจะถูกคูณตามโบนัสนี้ทันที!'
                    : 'Complete this chore this week to earn multiplied bonus points!'}
                </p>
              </div>

              <button
                onClick={() => setIsGachaModalOpen(false)}
                className="w-full py-2.5 rounded-[14px] bg-[#5D4037] text-white text-[13px] font-bold hover:opacity-90 transition-all cursor-pointer"
              >
                {language === 'th' ? 'รับทราบ' : 'Got it!'}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: GACHA HISTORY / STATUS                            */}
        {/* ======================================================== */}
        {isGachaHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up">
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2] flex items-center gap-1.5">
                  <Dice5 className="w-4 h-4 text-[#5D4037]" />
                  <span>{language === 'th' ? 'ประวัติกล่องสุ่ม' : 'Mystery Box History'}</span>
                </h3>
                <button
                  onClick={() => setIsGachaHistoryModalOpen(false)}
                  className="p-1 rounded-full text-[#8D6E63] hover:bg-[#D7CCC8]/30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[350px] overflow-y-auto space-y-2.5">
                {gachaSpins.length === 0 ? (
                  <p className="text-[12px] text-center text-[#8D6E63] py-6">
                    {language === 'th' ? 'ยังไม่มีประวัติการสุ่ม' : 'No spin history yet'}
                  </p>
                ) : (
                  gachaSpins.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-white dark:bg-[#2A2724] rounded-[14px] border border-[#D7CCC8]/60 dark:border-[#3D3835] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                          {s.chore_title}
                        </div>
                        <div className="text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                          {new Date(s.created_at).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] font-outfit font-bold text-[13px]">
                        x{s.multiplier}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

export default function RewardsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen bg-[#FDFBF7] dark:bg-[#141312]">
          <Loader2 className="w-8 h-8 animate-spin text-[#8D6E63]" />
        </div>
      }
    >
      <RewardsPageContent />
    </Suspense>
  );
}
