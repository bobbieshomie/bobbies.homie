'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
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
  Trophy,
  Crown,
  Sliders,
  Dices,
  Eye,
  EyeOff,
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
  fetchGachaConfig,
  proposeGachaConfig,
  respondGachaConfigProposal,
  cancelGachaConfigProposal,
  type DbChore,
  type DbChoreReward,
  type DbRewardRedemption,
  type DbChorePointLog,
  type DbProfile,
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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

function playTickSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.035);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.005, ctx.currentTime + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  } catch {}
}

function playDingSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

function playWinSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 victory chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + idx * 0.09;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.14, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch {}
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

  // Confirm Dialog State for Deletions
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    description?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    onConfirm: () => {},
  });

  // =========================================================================
  // Customizable Reward Gacha (Dynamic Prize Count with 2-Person Approval)
  // Unlimited spins, configurable rates (%) summing to 100%
  // =========================================================================
  interface RewardGachaTier {
    tier: number;
    label: string; // e.g., 'รางวัลที่ 1 (ใหญ่สุด)'
    title: string; // Custom prize name
    rate: number;  // Percentage (e.g., 5, 10, 20...)
    color: string; // Aesthetic gradient/color
    icon: string;  // Gift, Crown, Trophy, Sparkles, Heart, Coffee, etc.
  }

  const DEFAULT_GACHA_PRIZES: RewardGachaTier[] = [
    { tier: 1, label: 'รางวัลใหญ่สุด', title: 'ทริปเที่ยวพักผ่อน 1 วันเต็ม', rate: 5, color: 'from-[#FFD54F] to-[#FF8F00]', icon: 'Crown' },
    { tier: 2, label: 'รางวัลใหญ่', title: 'ดินเนอร์มื้อโปรดตามใจ 1 มื้อ', rate: 10, color: 'from-[#FF7043] to-[#D84315]', icon: 'Trophy' },
    { tier: 3, label: 'รางวัลพิเศษ', title: 'ช้อปปิ้งของที่อยากได้ 300 บาท', rate: 15, color: 'from-[#AB47BC] to-[#6A1B9A]', icon: 'ShoppingBag' },
    { tier: 4, label: 'รางวัลน่ารัก', title: 'ของหวาน / ไอศกรีม 1 มื้อ', rate: 20, color: 'from-[#29B6F6] to-[#0277BD]', icon: 'Utensils' },
    { tier: 5, label: 'รางวัลช่วยงาน', title: 'ยกเว้นล้างจาน 1 วัน', rate: 25, color: 'from-[#66BB6A] to-[#2E7D32]', icon: 'Sparkles' },
    { tier: 6, label: 'รางวัลปลอบใจ', title: 'นวดไหล่ 10 นาที / อ้อนแฟน', rate: 25, color: 'from-[#FFA726] to-[#EF6C00]', icon: 'Heart' },
  ];

  const [gachaPrizes, setGachaPrizes] = useState<RewardGachaTier[]>(DEFAULT_GACHA_PRIZES);
  const [gachaCost, setGachaCost] = useState<number>(10);
  const [gachaConfigRecord, setGachaConfigRecord] = useState<DbChoreReward | null>(null);

  // Modals for Gacha
  const [isGachaConfigModalOpen, setIsGachaConfigModalOpen] = useState(false);
  const [isViewPrizesModalOpen, setIsViewPrizesModalOpen] = useState(false);
  const [draftConfigPrizes, setDraftConfigPrizes] = useState<RewardGachaTier[]>([]);
  const [draftGachaCost, setDraftGachaCost] = useState<number>(10);
  const [savingGachaConfig, setSavingGachaConfig] = useState(false);

  // Gacha Playing Modal & Animation States
  const [isGachaModalOpen, setIsGachaModalOpen] = useState(false);
  const [isGachaHistoryModalOpen, setIsGachaHistoryModalOpen] = useState(false);
  const [isSpinningGacha, setIsSpinningGacha] = useState(false);
  const [gachaHistory, setGachaHistory] = useState<
    Array<{ id: string; prize: RewardGachaTier; date: string; pointsSpent: number }>
  >([]);
  const [spinResultPrize, setSpinResultPrize] = useState<{
    prize: RewardGachaTier;
    pointsSpent: number;
  } | null>(null);

  // Single Horizontal Prize Slot Reel
  const [prizeReel, setPrizeReel] = useState<RewardGachaTier[]>([]);
  const [prizeTranslateX, setPrizeTranslateX] = useState<number>(0);
  const [isPrizeSpinning, setIsPrizeSpinning] = useState<boolean>(false);
  const [gachaAnimationFinished, setGachaAnimationFinished] = useState<boolean>(false);
  const prizeViewportRef = useRef<HTMLDivElement>(null);

  // Load configured prizes & gacha history per household from localStorage fallback
  useEffect(() => {
    if (householdId) {
      try {
        const savedCost = localStorage.getItem(`gacha_cost_${householdId}`);
        if (savedCost && !isNaN(Number(savedCost)) && Number(savedCost) >= 0) {
          setGachaCost(Number(savedCost));
        }

        const savedPrizes = localStorage.getItem(`reward_gacha_prizes_${householdId}`);
        if (savedPrizes) {
          const parsed = JSON.parse(savedPrizes);
          if (Array.isArray(parsed) && parsed.length >= 2) setGachaPrizes(parsed);
        }

        const savedHist = localStorage.getItem(`reward_gacha_hist_${householdId}`);
        if (savedHist) {
          const parsed = JSON.parse(savedHist);
          if (Array.isArray(parsed)) setGachaHistory(parsed);
        }
      } catch (e) {
        console.warn('Failed to load gacha settings:', e);
      }
    }
  }, [householdId]);

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
          gachaConfigRes,
        ] = await Promise.all([
          fetchChores(hId),
          fetchChoreRewards(hId),
          fetchRewardRedemptions(hId),
          fetchChorePointLogs(hId),
          fetchHouseholdMembers(hId),
          fetchGachaConfig(hId),
        ]);

        setChores(choresRes);
        setRewards(rewardsRes);
        setRedemptions(redemptionsRes);
        setPointLogs(pointLogsRes);
        setMembers(membersRes);

        if (gachaConfigRes) {
          setGachaConfigRecord(gachaConfigRes);
          if (gachaConfigRes.status === 'active' && gachaConfigRes.description) {
            try {
              const parsed = JSON.parse(gachaConfigRes.description);
              if (Array.isArray(parsed) && parsed.length >= 2) {
                setGachaPrizes(parsed);
                try {
                  localStorage.setItem(`reward_gacha_prizes_${hId}`, JSON.stringify(parsed));
                } catch {}
              }
            } catch {}
          }
          if (gachaConfigRes.points_cost !== undefined) {
            setGachaCost(gachaConfigRes.points_cost);
            try {
              localStorage.setItem(`gacha_cost_${hId}`, String(gachaConfigRes.points_cost));
            } catch {}
          }
        }
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
    const gachaProposalForMe =
      gachaConfigRecord?.status === 'pending_edit' && gachaConfigRecord.proposed_by !== currentUserId
        ? 1
        : 0;
    return proposalsForMe + redemptionsForMe + gachaProposalForMe;
  }, [pendingRewardProposals, pendingRedemptions, gachaConfigRecord, currentUserId]);

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

  // Helper to get weighted random prize based on tier percentages
  const pickWeightedPrize = (prizes: RewardGachaTier[]): RewardGachaTier => {
    const totalWeight = prizes.reduce((acc, p) => acc + (Number(p.rate) || 0), 0);
    let rand = Math.random() * (totalWeight > 0 ? totalWeight : 100);
    for (const p of prizes) {
      if (rand < (Number(p.rate) || 0)) {
        return p;
      }
      rand -= Number(p.rate) || 0;
    }
    return prizes[prizes.length - 1];
  };

  // Start Horizontal Prize Slot Reel Animation (Suspense duration ~4.8s)
  const startPrizeSlotAnimation = (targetPrize: RewardGachaTier, cost: number) => {
    const targetIndex = 28;
    const durationMs = 4800;

    // Build Prize Reel: target lands at targetIndex
    const reel: RewardGachaTier[] = [];
    for (let i = 0; i < targetIndex; i++) {
      reel.push(gachaPrizes[i % gachaPrizes.length]);
    }
    reel.push(targetPrize); // Winner prize
    for (let i = 0; i < 6; i++) {
      reel.push(gachaPrizes[(i + 1) % gachaPrizes.length]);
    }

    setPrizeReel(reel);
    setPrizeTranslateX(0);
    setIsPrizeSpinning(false);
    setGachaAnimationFinished(false);
    setSpinResultPrize({ prize: targetPrize, pointsSpent: cost });
    setIsGachaModalOpen(true);

    // Trigger smooth horizontal reel animation
    setTimeout(() => {
      const viewportWidth = prizeViewportRef.current?.offsetWidth || 320;
      const cardWidth = 150;
      const cardGap = 12;
      const cardStep = cardWidth + cardGap;
      const targetX = -(targetIndex * cardStep - (viewportWidth - cardWidth) / 2);

      setIsPrizeSpinning(true);
      setPrizeTranslateX(targetX);

      // Sound ticks
      let tickCount = 0;
      const maxTicks = 42;
      const tickSpeed = 110;
      const tickInterval = setInterval(() => {
        playTickSound();
        tickCount++;
        if (tickCount >= maxTicks) clearInterval(tickInterval);
      }, tickSpeed);

      // Stop spin and display winning celebration
      setTimeout(() => {
        setIsPrizeSpinning(false);
        setGachaAnimationFinished(true);
        playWinSound();

        // Record history locally
        if (householdId) {
          const newEntry = {
            id: String(Date.now()),
            prize: targetPrize,
            date: new Date().toISOString(),
            pointsSpent: cost,
          };
          setGachaHistory((prev) => {
            const updated = [newEntry, ...prev].slice(0, 50);
            try {
              localStorage.setItem(`reward_gacha_hist_${householdId}`, JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }
      }, durationMs);
    }, 60);
  };

  // Handle Unlimited Reward Gacha Spin
  const handleSpinRewardGacha = async () => {
    if (!currentUserId || !householdId) return;

    if (myPoints < gachaCost) {
      alert(
        language === 'th'
          ? `คะแนนของคุณไม่พอสำหรับการสุ่ม (ต้องการ ${gachaCost} คะแนน แต่คุณมี ${myPoints} คะแนน)`
          : `Insufficient points (${gachaCost} pts required, you have ${myPoints} pts)`
      );
      return;
    }

    if (gachaPrizes.length === 0) {
      alert(language === 'th' ? 'กรุณาตั้งค่ารางวัลก่อนสุ่ม' : 'Please configure prizes first');
      return;
    }

    try {
      setIsSpinningGacha(true);
      const pickedPrize = pickWeightedPrize(gachaPrizes);
      const newPoints = Math.max(0, myPoints - gachaCost);

      // Deduct points from profile and log into ledger if cost > 0
      const supabase = createClient();
      if (gachaCost > 0) {
        await (supabase.from('profiles') as any)
          .update({ chore_points: newPoints, updated_at: new Date().toISOString() })
          .eq('id', currentUserId);

        await (supabase.from('chore_point_logs') as any).insert({
          household_id: householdId,
          user_id: currentUserId,
          title: `สุ่มรางวัล (${gachaPrizes.length} รางวัล) ได้ "${pickedPrize.title}"`,
          points_delta: -gachaCost,
          balance_after: newPoints,
          type: 'gacha_spend',
        });
      }

      setMyPoints(newPoints);
      startPrizeSlotAnimation(pickedPrize, gachaCost);
      loadData();

      // Push notification broadcast to household
      const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          excludeUserId: currentUserId,
          title: '🎰 Bobbies Homie - สุ่มรางวัล!',
          body: language === 'th'
            ? `${senderName} สุ่มวงล้อรางวัลได้ "${pickedPrize.title}" (${pickedPrize.label})! 🎉`
            : `${senderName} spun the reward wheel and won "${pickedPrize.title}" (${pickedPrize.label})! 🎉`,
          link: '/rewards',
        }),
      }).catch(() => {});
    } catch (err: any) {
      alert(err?.message || 'Error spinning gacha');
    } finally {
      setIsSpinningGacha(false);
    }
  };

  // Open Config Modal for editing tier prizes and percentages
  const handleOpenGachaConfigModal = () => {
    setDraftConfigPrizes(JSON.parse(JSON.stringify(gachaPrizes)));
    setDraftGachaCost(gachaCost);
    setIsGachaConfigModalOpen(true);
  };

  // Add prize tier to draft
  const handleAddPrizeTier = () => {
    if (draftConfigPrizes.length >= 10) return;
    const newTier = draftConfigPrizes.length + 1;
    const colors = [
      'from-[#FFD54F] to-[#FF8F00]',
      'from-[#FF7043] to-[#D84315]',
      'from-[#AB47BC] to-[#6A1B9A]',
      'from-[#29B6F6] to-[#0277BD]',
      'from-[#66BB6A] to-[#2E7D32]',
      'from-[#FFA726] to-[#EF6C00]',
      'from-[#EC407A] to-[#C2185B]',
      'from-[#26A69A] to-[#00796B]',
      'from-[#7E57C2] to-[#512DA8]',
      'from-[#8D6E63] to-[#4E342E]',
    ];
    setDraftConfigPrizes((prev) => [
      ...prev,
      {
        tier: newTier,
        label: `รางวัลที่ ${newTier}`,
        title: '',
        rate: 0,
        color: colors[(newTier - 1) % colors.length],
        icon: 'Sparkles',
      },
    ]);
  };

  // Remove prize tier from draft
  const handleRemovePrizeTier = (index: number) => {
    if (draftConfigPrizes.length <= 2) {
      alert(language === 'th' ? 'ต้องมีอย่างน้อย 2 รางวัล' : 'At least 2 prizes required');
      return;
    }
    setDraftConfigPrizes((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((p, idx) => ({
        ...p,
        tier: idx + 1,
        label: idx === 0 ? 'รางวัลใหญ่สุด' : idx === next.length - 1 ? 'รางวัลปลอบใจ' : `รางวัลที่ ${idx + 1}`,
      }));
    });
  };

  // Auto-distribute rates evenly
  const handleAutoBalanceRates = () => {
    const count = draftConfigPrizes.length;
    if (count === 0) return;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;
    setDraftConfigPrizes((prev) =>
      prev.map((p, idx) => ({
        ...p,
        rate: idx === count - 1 ? base + remainder : base,
      }))
    );
  };

  // Submit Gacha Configuration Proposal (Dual approval required if 2 members)
  const handleSubmitGachaConfigProposal = async () => {
    if (!householdId || !currentUserId) return;
    const totalRate = draftConfigPrizes.reduce((sum, p) => sum + (Number(p.rate) || 0), 0);
    if (totalRate !== 100) {
      alert(
        language === 'th'
          ? `ผลรวมของโอกาสการออกรางวัลทั้งหมดต้องเท่ากับ 100% พอดี (ตอนนี้รวมได้ ${totalRate}%)`
          : `Total rate percentage must sum to 100% exactly (currently ${totalRate}%)`
      );
      return;
    }
    if (draftConfigPrizes.some((p) => !p.title.trim())) {
      alert(language === 'th' ? 'กรุณาระบุชื่อรางวัลให้ครบทุกช่อง' : 'Please name all prizes');
      return;
    }

    const needsApproval = members.length > 1;

    try {
      setSavingGachaConfig(true);
      const updatedRecord = await proposeGachaConfig(
        householdId,
        currentUserId,
        {
          cost: draftGachaCost,
          prizes: draftConfigPrizes,
        },
        needsApproval
      );

      setGachaConfigRecord(updatedRecord);

      if (needsApproval) {
        showToast(
          language === 'th'
            ? 'ส่งคำขอแก้ไขการตั้งค่าสุ่มรางวัลแล้ว รอคนในบ้านอนุมัติ'
            : 'Proposal submitted! Waiting for partner approval'
        );
        const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            excludeUserId: currentUserId,
            title: '🎰 Bobbies Homie - ตั้งค่าสุ่มรางวัล',
            body: language === 'th'
              ? `${senderName} เสนอปรับปรุงรางวัลและเรทวงล้อสุ่มรางวัล รอคุณอนุมัติ`
              : `${senderName} proposed updating reward gacha prizes & rates`,
            link: '/rewards?tab=manage',
          }),
        }).catch(() => {});
      } else {
        setGachaCost(draftGachaCost);
        setGachaPrizes(draftConfigPrizes);
        try {
          localStorage.setItem(`reward_gacha_prizes_${householdId}`, JSON.stringify(draftConfigPrizes));
          localStorage.setItem(`gacha_cost_${householdId}`, String(draftGachaCost));
        } catch (e) {}
        showToast(language === 'th' ? 'บันทึกการตั้งค่าสุ่มรางวัลสำเร็จ' : 'Gacha configuration saved');
      }

      setIsGachaConfigModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to submit proposal');
    } finally {
      setSavingGachaConfig(false);
    }
  };

  // Respond to Gacha Proposal (Partner approves or rejects)
  const handleRespondGachaProposal = async (approve: boolean) => {
    if (!gachaConfigRecord || !householdId || !currentUserId) return;
    try {
      await respondGachaConfigProposal(gachaConfigRecord, approve);
      if (approve) {
        const payload = gachaConfigRecord.pending_payload;
        if (payload) {
          if (payload.gacha_prizes) {
            setGachaPrizes(payload.gacha_prizes);
            try {
              localStorage.setItem(`reward_gacha_prizes_${householdId}`, JSON.stringify(payload.gacha_prizes));
            } catch (e) {}
          } else if (payload.description) {
            try {
              const parsed = JSON.parse(payload.description);
              if (Array.isArray(parsed)) {
                setGachaPrizes(parsed);
                localStorage.setItem(`reward_gacha_prizes_${householdId}`, JSON.stringify(parsed));
              }
            } catch {}
          }
          const newCost = payload.points_cost ?? payload.gacha_cost;
          if (newCost !== undefined) {
            setGachaCost(newCost);
            try {
              localStorage.setItem(`gacha_cost_${householdId}`, String(newCost));
            } catch {}
          }
        }
        showToast(language === 'th' ? 'อนุมัติการตั้งค่าสุ่มรางวัลเรียบร้อย' : 'Gacha configuration approved');
      } else {
        showToast(language === 'th' ? 'ปฏิเสธคำขอเรียบร้อย' : 'Proposal rejected');
      }

      const senderName = currentMember?.nickname || currentMember?.full_name || (language === 'th' ? 'คนในบ้าน' : 'Partner');
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          excludeUserId: currentUserId,
          title: '🎰 Bobbies Homie',
          body: language === 'th'
            ? `${senderName} ${approve ? 'อนุมัติ' : 'ปฏิเสธ'} คำขอตั้งค่าสุ่มรางวัลแล้ว`
            : `${senderName} ${approve ? 'approved' : 'rejected'} gacha configuration proposal`,
          link: '/rewards?tab=manage',
        }),
      }).catch(() => {});

      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to respond to proposal');
    }
  };

  // Cancel Gacha Proposal (Proposer only)
  const handleCancelGachaProposal = async () => {
    if (!gachaConfigRecord) return;
    try {
      await cancelGachaConfigProposal(gachaConfigRecord);
      showToast(language === 'th' ? 'ยกเลิกคำขอแล้ว' : 'Proposal cancelled');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel proposal');
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

  // Propose Delete Reward with ConfirmDialog
  const handleDeleteRewardProposal = (reward: DbChoreReward) => {
    if (!currentUserId) return;
    const isSolo = members.length <= 1;

    if (isSolo) {
      setConfirmDialog({
        isOpen: true,
        title: language === 'th' ? 'ยืนยันที่จะลบของรางวัล' : 'Delete Reward?',
        description: language === 'th'
          ? `ต้องการลบของรางวัล "${reward.title}" ใช่หรือไม่?`
          : `Are you sure you want to delete "${reward.title}"?`,
        onConfirm: async () => {
          try {
            await deleteChoreReward(reward.id);
            showToast(language === 'th' ? 'ลบของรางวัลเรียบร้อยแล้ว' : 'Reward deleted');
            await loadData();
          } catch (err: any) {
            alert(err?.message || 'Failed to delete');
          }
        },
      });
    } else {
      setConfirmDialog({
        isOpen: true,
        title: language === 'th' ? 'ขอลบของรางวัล' : 'Propose Delete Reward?',
        description: language === 'th'
          ? `ขอลบรางวัล "${reward.title}" ใช่ไหม? (ระบบจะส่งคำขอไปยังคนในบ้านเพื่อยืนยัน)`
          : `Propose deleting "${reward.title}"? Partner confirmation required.`,
        onConfirm: async () => {
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
        },
      });
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
                <Gift className="w-5 h-5 text-[#E0533C] shrink-0" />
                <span className="truncate">{language === 'th' ? 'ร้านค้ารางวัล' : 'Rewards Shop'}</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Link to Chores page */}
              <Link
                href="/chores"
                className="font-dm-sans px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-80 transition-colors shadow-2xs"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>{language === 'th' ? 'งานบ้าน' : 'Chores'}</span>
              </Link>

              <NotificationBell />
            </div>
          </div>

          <p className="font-dm-sans text-[12.5px] leading-normal text-[#8D6E63] dark:text-[#948D87] pl-0.5">
            {language === 'th' ? 'ใช้คะแนนสะสมแลกรางวัล หรือจัดการของรางวัล' : 'Redeem rewards and manage approvals'}
          </p>
        </div>

        {/* ======================================================== */}
        {/* PROMINENT POINTS BALANCE CARD (THIS IS THE REWARD HUB)   */}
        {/* ======================================================== */}
        <div className="px-6 mb-3">
          <div className="p-4 bg-gradient-to-br from-[#FFF9F5] to-[#F4EFEA] dark:from-[#25221F] dark:to-[#1F1D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.06)]">
            <div className="flex items-center justify-between gap-2">
              {/* My Points - Clean Single line layout */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-[14px] bg-[#5D4037] dark:bg-[#3D2C22] border border-[#5D4037]/20 dark:border-[#FFD54F]/30 text-[#FFD54F] flex items-center justify-center shrink-0 shadow-xs">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <span className="font-dm-sans text-[13px] font-bold text-[#8D6E63] dark:text-[#948D87] shrink-0">
                    {t.chores.myPoints}:
                  </span>
                  <span className="font-outfit font-extrabold text-[22px] leading-tight text-[#5D4037] dark:text-[#DDD7D2]">
                    {myPoints}
                  </span>
                  <span className="font-dm-sans text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87]">
                    {t.chores.pointsUnit}
                  </span>
                </div>
              </div>

              {/* Link to Household members page */}
              <Link
                href="/household"
                className="flex items-center gap-1 text-[11.5px] font-bold text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] dark:hover:text-[#DDD7D2] px-2.5 py-1.5 rounded-[12px] bg-white/70 dark:bg-[#141312]/70 border border-[#D7CCC8]/60 dark:border-[#2E2A27] transition-colors shrink-0 cursor-pointer shadow-2xs"
                title={language === 'th' ? 'ดูคะแนนคนในบ้าน' : 'Housemates Points'}
              >
                <Users className="w-3.5 h-3.5 text-[#5D4037] dark:text-[#DDD7D2]" />
                <span>{language === 'th' ? 'คนในบ้าน' : 'Members'}</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SLIDEBAR TAB NAVIGATION                                  */}
        {/* ======================================================== */}
        <div className="px-6 py-1 w-full mb-2 font-dm-sans">
          <div className="flex items-center gap-1.5 p-1.5 bg-[#F4EFEA] dark:bg-[#23201D] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[20px] overflow-x-auto no-scrollbar scroll-smooth">
            {/* Tab 1: ร้านค้า */}
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer font-dm-sans whitespace-nowrap shrink-0 ${
                activeTab === 'shop'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <Gift className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'th' ? 'ร้านค้า' : 'Shop'}</span>
              <span className="font-outfit px-1.5 py-0.2 rounded-full bg-[#5D4037]/10 dark:bg-[#DDD7D2]/10 text-[10px] font-bold">
                {activeShopRewards.length}
              </span>
            </button>

            {/* Tab 2: ประวัติการแลกรางวัล */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 min-w-[110px] py-2 px-2.5 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer font-dm-sans whitespace-nowrap shrink-0 ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'th' ? 'ประวัติการแลก' : 'Redemptions'}</span>
            </button>

            {/* Tab 3: จัดการรางวัล & อนุมัติ 2 คน */}
            <button
              onClick={() => setActiveTab('manage')}
              className={`relative flex-1 min-w-[100px] py-2 px-2.5 text-[12px] font-bold rounded-[14px] transition-all flex items-center justify-center gap-1.5 cursor-pointer font-dm-sans whitespace-nowrap shrink-0 ${
                activeTab === 'manage'
                  ? 'bg-white dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                  : 'text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'th' ? 'จัดการรางวัล' : 'Manage'}</span>
              {totalPendingApprovalsForMe > 0 && (
                <span className="font-outfit w-4 h-4 rounded-full bg-[#E0533C] text-white text-[9px] font-extrabold flex items-center justify-center animate-pulse shrink-0">
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
          <div className="px-6 pt-2 space-y-3 font-dm-sans">
            {/* Reward Gacha Hub */}
            <div className="p-4 bg-gradient-to-br from-[#FAF7F2] to-[#F5EFEB] dark:from-[#201D1A] dark:to-[#1A1816] border border-[#E0D7D0] dark:border-[#2E2A27] rounded-[24px] shadow-sm space-y-3">
              {/* Header: Title, Icon & Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-[12px] bg-[#FFEBEE] dark:bg-[#361E1E] border border-[#FFCDD2]/60 dark:border-[#4E2727] flex items-center justify-center text-[#E0533C] dark:text-[#FF8A80] shadow-xs shrink-0">
                    <Dices className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-outfit text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? 'วงล้อสุ่มของรางวัล' : 'Reward Gacha'}
                    </h3>
                  </div>
                </div>

                {/* Top Action Buttons: View Prizes & History */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsViewPrizesModalOpen(true)}
                    className="font-dm-sans px-2.5 py-1.5 rounded-[12px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8]/70 dark:border-[#3D3835] text-[#5D4037] dark:text-[#DDD7D2] text-[11.5px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                    title={language === 'th' ? 'ดูรายการของรางวัลและโอกาสได้รับ' : 'View prizes & winning rates'}
                  >
                    <Eye className="w-3.5 h-3.5 text-[#E0533C]" />
                    <span>{language === 'th' ? 'ดูรายการรางวัล' : 'View Prizes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsGachaHistoryModalOpen(true)}
                    className="font-dm-sans px-2.5 py-1.5 rounded-[12px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8]/70 dark:border-[#3D3835] text-[#8D6E63] dark:text-[#948D87] text-[11.5px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                    title={language === 'th' ? 'ประวัติที่เคยสุ่มได้' : 'History'}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'ประวัติ' : 'History'}</span>
                  </button>
                </div>
              </div>

              {/* Bottom Spin Trigger */}
              <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27]">
                <button
                  type="button"
                  onClick={handleSpinRewardGacha}
                  disabled={isSpinningGacha || myPoints < gachaCost}
                  className={`w-full font-outfit py-2.5 rounded-[14px] text-[13px] font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    myPoints >= gachaCost
                      ? 'bg-gradient-to-r from-[#E65100] via-[#F57C00] to-[#FFA000] text-white hover:brightness-105 active:scale-95 shadow-[0_4px_14px_rgba(230,81,0,0.35)]'
                      : 'bg-[#D7CCC8]/50 dark:bg-[#2A2724] text-[#8D6E63] dark:text-[#7A726C] cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSpinningGacha ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {language === 'th'
                          ? `หมุนวงล้อสุ่มรางวัล (${gachaCost} pt)`
                          : `Spin Reward Gacha (${gachaCost} pt)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Shop Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="font-outfit text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.tabRewards}
                </h2>
                <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                  {language === 'th' ? 'ใช้คะแนนสะสมแลกรางวัลที่อนุมัติแล้ว' : 'Redeem approved household rewards'}
                </p>
              </div>

              <button
                onClick={() => setActiveTab('manage')}
                className="font-dm-sans px-2.5 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#24211E] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] text-[11px] font-bold flex items-center gap-1 hover:opacity-90 cursor-pointer"
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
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6 font-dm-sans">
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
                          <h3 className="font-outfit text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                            {reward.title}
                          </h3>
                          {reward.description && (
                            <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate mt-0.5">
                              {reward.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="font-outfit font-extrabold text-[15px] text-[#E0533C]">
                              {reward.points_cost}
                            </span>
                            <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              {t.chores.pointsUnit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Redeem Action Button */}
                      <button
                        onClick={() => setRedeemConfirmItem(reward)}
                        disabled={!canAfford}
                        className={`font-dm-sans px-3.5 py-2 rounded-[12px] text-[12px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
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
          <div className="px-6 pt-2 space-y-3 font-dm-sans">
            <div>
              <h2 className="font-outfit text-[18px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'ประวัติการแลกของรางวัล' : 'Reward Redemption Log'}
              </h2>
              <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th' ? 'แสดงรายการของรางวัลที่แลก วันที่ และคะแนนที่ใช้' : 'History of redeemed rewards, dates, and points cost'}
              </p>
            </div>

            {rewardLogs.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-[#201D1A] rounded-[20px] border border-[#D7CCC8]/60 dark:border-[#2E2A27] p-6">
                <History className="w-10 h-10 text-[#8D6E63]/40 mx-auto mb-2" />
                <p className="font-dm-sans text-[14px] font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
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
                            <span className="font-dm-sans text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87]">
                              {log.userName}
                            </span>
                            <span className="font-dm-sans text-[10px] text-[#8D6E63]/60 dark:text-[#948D87]/60">
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

                          <h4 className="font-outfit text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                            {log.rewardTitle}
                          </h4>

                          {/* Status Badge */}
                          <div className="mt-1">
                            {log.status === 'pending' && (
                              <span className="inline-block font-dm-sans text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#FFF3E0] text-[#E65100]">
                                {language === 'th' ? 'รออนุมัติ' : 'Pending'}
                              </span>
                            )}
                            {log.status === 'approved' && (
                              <span className="inline-block font-dm-sans text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                                {language === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
                              </span>
                            )}
                            {log.status === 'rejected' && (
                              <span className="inline-block font-dm-sans text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#FFEBEE] text-[#C62828]">
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
                        <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] ml-1">
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
          <div className="px-6 pt-2 space-y-4 font-dm-sans">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-outfit text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'จัดการของรางวัล & อนุมัติ' : 'Manage Rewards & Approvals'}
                </h2>
                <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  {language === 'th' ? 'เพิ่ม แก้ไข หรือลบรางวัล ต้องได้รับการยืนยันจากทั้งสองคน' : 'Propose reward changes with two-person confirmation'}
                </p>
              </div>

              <button
                onClick={openCreateRewardModal}
                className="px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] font-dm-sans text-[12px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'เพิ่มรางวัล' : 'Add Reward'}</span>
              </button>
            </div>

            {/* Approvals Queue */}
            {(pendingRewardProposals.length > 0 || pendingRedemptions.length > 0 || gachaConfigRecord?.status === 'pending_edit') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-outfit text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  <ShieldCheck className="w-4 h-4 text-[#E65100]" />
                  <span>{language === 'th' ? `คำขอที่รอการยืนยัน & อนุมัติ (${totalPendingApprovalsForMe})` : `Pending Approvals (${totalPendingApprovalsForMe})`}</span>
                </div>

                {/* Gacha Configuration Proposal Card */}
                {gachaConfigRecord?.status === 'pending_edit' && (
                  <div className="p-4 bg-white dark:bg-[#201D1A] border-2 border-[#E65100]/40 rounded-[20px] space-y-3 shadow-xs font-dm-sans">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-dm-sans text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5 min-w-0 flex-1">
                        <Dices className="w-4 h-4 text-[#E0533C] shrink-0" />
                        <span className="truncate">
                          {gachaConfigRecord.proposed_by === currentUserId
                            ? (language === 'th' ? 'คุณเสนอเปลี่ยนการตั้งค่าวงล้อสุ่มรางวัล' : 'You proposed updating gacha settings')
                            : (language === 'th' ? `${partnerMember?.nickname || partnerMember?.full_name || 'คนในบ้าน'} เสนอเปลี่ยนการตั้งค่าสุ่มรางวัล` : 'Partner proposed gacha settings update')}
                        </span>
                      </span>
                      <span className="font-dm-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D] shrink-0 whitespace-nowrap">
                        {gachaConfigRecord.proposed_by === currentUserId
                          ? (language === 'th' ? 'รอคนในบ้านยืนยัน' : 'Waiting partner')
                          : (language === 'th' ? 'รอคุณอนุมัติ' : 'Waiting your approval')}
                      </span>
                    </div>

                    {/* Proposal Details */}
                    <div className="p-3 bg-[#FAF7F2] dark:bg-[#1A1816] rounded-[14px] border border-[#E0D7D0] dark:border-[#2E2A27] space-y-2 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#8D6E63] dark:text-[#948D87]">{language === 'th' ? 'ค่าสุ่มต่อครั้งที่เสนอ:' : 'Proposed Cost:'}</span>
                        <span className="font-outfit font-bold text-[#E0533C]">
                          {gachaConfigRecord.pending_payload?.gacha_cost ?? gachaConfigRecord.pending_payload?.points_cost ?? gachaCost} {t.chores.pointsUnit}
                        </span>
                      </div>
                      <div className="text-[#8D6E63] dark:text-[#948D87]">
                        <span>{language === 'th' ? `รายการรางวัลที่เสนอใหม่ (${(gachaConfigRecord.pending_payload?.gacha_prizes || []).length} รางวัล):` : 'Proposed Prizes:'}</span>
                      </div>
                      <div className="space-y-1 max-h-[140px] overflow-y-auto no-scrollbar">
                        {(gachaConfigRecord.pending_payload?.gacha_prizes || []).map((p: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-[11.5px] p-1.5 bg-white dark:bg-[#25221F] rounded-[8px] border border-[#D7CCC8]/40">
                            <span className="font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                              {p.tier}. {p.title} <span className="font-normal text-[10px] text-[#8D6E63]">({p.label})</span>
                            </span>
                            <span className="font-outfit font-extrabold text-[#E65100] shrink-0 ml-1">{p.rate}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27]">
                      {gachaConfigRecord.proposed_by === currentUserId ? (
                        <button
                          type="button"
                          onClick={handleCancelGachaProposal}
                          className="px-3 py-1.5 rounded-[12px] bg-[#F4EFEA] dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[#8D6E63] dark:text-[#948D87] text-[12px] font-bold hover:opacity-80 cursor-pointer"
                        >
                          {language === 'th' ? 'ยกเลิกคำขอ' : 'Cancel'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRespondGachaProposal(false)}
                            className="px-3 py-1.5 rounded-[12px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-[12px] font-bold hover:opacity-80 cursor-pointer"
                          >
                            {language === 'th' ? 'ปฏิเสธ' : 'Reject'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondGachaProposal(true)}
                            className="px-3.5 py-1.5 rounded-[12px] bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{language === 'th' ? 'อนุมัติการตั้งค่า' : 'Approve'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

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
                      className="p-4 bg-white dark:bg-[#201D1A] border-2 border-[#E65100]/30 rounded-[20px] space-y-3 shadow-xs font-dm-sans"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-dm-sans text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5 min-w-0 flex-1">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {proposerName}{' '}
                            {isPendingCreate && (language === 'th' ? 'เสนอเพิ่มรางวัลใหม่' : 'proposed new reward')}
                            {isPendingEdit && (language === 'th' ? 'เสนอแก้ไขรางวัล' : 'proposed editing reward')}
                            {isPendingDelete && (language === 'th' ? 'เสนอขอลบรางวัล' : 'proposed deleting reward')}
                          </span>
                        </span>

                        <span className="font-dm-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D] shrink-0 whitespace-nowrap">
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
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-outfit text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                                {reward.title}
                              </h3>
                              {reward.description && (
                                <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] line-clamp-2">
                                  {reward.description}
                                </p>
                              )}
                            </div>
                            <span className="font-outfit font-extrabold text-[15px] text-[#E0533C] shrink-0 whitespace-nowrap">
                              {reward.points_cost} {t.chores.pointsUnit}
                            </span>
                          </div>
                        )}

                        {isPendingEdit && (
                          <div className="space-y-1">
                            <div className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate">
                              เดิม: <span className="line-through">{reward.title}</span> ({reward.points_cost} คะแนน)
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-outfit text-[14px] font-bold text-[#2E7D32] dark:text-[#81C784] truncate">
                                  ใหม่: {reward.pending_payload?.title || reward.title}
                                </h3>
                                {reward.pending_payload?.description && (
                                  <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] line-clamp-2">
                                    {reward.pending_payload.description}
                                  </p>
                                )}
                              </div>
                              <span className="font-outfit font-extrabold text-[15px] text-[#E0533C] shrink-0 whitespace-nowrap">
                                {reward.pending_payload?.points_cost ?? reward.points_cost} {t.chores.pointsUnit}
                              </span>
                            </div>
                          </div>
                        )}

                        {isPendingDelete && (
                          <div>
                            <h3 className="font-outfit text-[14px] font-bold text-[#C62828] truncate">
                              ขอลบรางวัล: &ldquo;{reward.title}&rdquo; ({reward.points_cost} คะแนน)
                            </h3>
                            <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              เมื่อทั้งสองคนอนุมัติ รางวัลนี้จะถูกลบออกจากร้านค้า
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] flex items-center gap-2">
                        {isMyProposal ? (
                          <button
                            onClick={() => handleCancelProposal(reward)}
                            className="w-full py-2 rounded-[12px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] font-dm-sans text-[12px] font-bold hover:bg-[#D7CCC8]/50 transition-colors cursor-pointer"
                          >
                            ยกเลิกคำขอ
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRespondProposal(reward, false)}
                              className="flex-1 py-2 rounded-[12px] bg-[#F4EFEA] dark:bg-[#292522] text-[#C62828] font-dm-sans text-[12px] font-bold hover:bg-[#FFEBEE] transition-colors cursor-pointer"
                            >
                              ปฏิเสธ
                            </button>
                            <button
                              onClick={() => handleRespondProposal(reward, true)}
                              className="flex-1 py-2 rounded-[12px] bg-[#2E7D32] text-white font-dm-sans text-[12px] font-bold hover:bg-[#1B5E20] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1"
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
                      className="p-4 bg-white dark:bg-[#201D1A] border-2 border-[#E65100]/30 rounded-[20px] space-y-3 shadow-xs font-dm-sans"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-dm-sans text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87] flex items-center gap-1.5 min-w-0 flex-1">
                          <Gift className="w-3.5 h-3.5 text-[#E65100] shrink-0" />
                          <span className="truncate">{requesterName} ขอแลกรางวัล:</span>
                        </span>

                        <span className="font-dm-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] dark:bg-[#E65100]/20 dark:text-[#FFB74D] shrink-0 whitespace-nowrap">
                          {isRequester
                            ? language === 'th'
                              ? 'รอคนในบ้านอนุมัติ'
                              : 'Waiting partner'
                            : language === 'th'
                            ? 'รอคุณอนุมัติ'
                            : 'Waiting your approval'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 py-1">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-outfit text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                            {red.reward_title || 'ของรางวัล'}
                          </h3>
                          <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
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
                        <span className="font-outfit font-extrabold text-[15px] text-[#E0533C] shrink-0 whitespace-nowrap">
                          -{red.points_spent} {t.chores.pointsUnit}
                        </span>
                      </div>

                      {!isRequester && (
                        <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27] flex items-center gap-2">
                          <button
                            onClick={() => handleRespondRedemption(red, false)}
                            className="flex-1 py-2 rounded-[12px] bg-[#F4EFEA] dark:bg-[#292522] text-[#C62828] font-dm-sans text-[12px] font-bold hover:bg-[#FFEBEE] transition-colors cursor-pointer"
                          >
                            {t.chores.reject}
                          </button>
                          <button
                            onClick={() => handleRespondRedemption(red, true)}
                            className="flex-1 py-2 rounded-[12px] bg-[#2E7D32] text-white font-dm-sans text-[12px] font-bold hover:bg-[#1B5E20] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1"
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

            {/* Gacha Mystery Box & Reward Wheel Settings Card */}
            <div className="p-4 bg-white dark:bg-[#201D1A] border border-[#E0D7D0] dark:border-[#2E2A27] rounded-[24px] shadow-sm space-y-3 font-dm-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-[12px] bg-[#FFEBEE] dark:bg-[#361E1E] border border-[#FFCDD2]/60 dark:border-[#4E2727] flex items-center justify-center text-[#E0533C] dark:text-[#FF8A80] shadow-xs shrink-0">
                    <Dices className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-outfit text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? 'การตั้งค่าวงล้อสุ่มของรางวัล' : 'Reward Gacha Settings'}
                    </h3>
                    <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      {language === 'th'
                        ? 'กำหนดของรางวัล เรทโอกาสออก และคะแนนที่ใช้ (ต้องอนุมัติทั้ง 2 คน)'
                        : 'Configure prizes, rates & spin cost (requires partner approval)'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenGachaConfigModal}
                  className="font-dm-sans px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0 self-end sm:self-auto"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#FFD54F] dark:text-[#E65100]" />
                  <span>{language === 'th' ? 'แก้ไขการตั้งค่าสุ่มรางวัล' : 'Edit Gacha Settings'}</span>
                </button>
              </div>

              {/* Status summary */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-[14px] bg-[#FAF7F2] dark:bg-[#262320] border border-[#E0D7D0]/60 dark:border-[#2E2A27] flex items-center justify-between">
                  <span className="text-[11.5px] text-[#8D6E63] dark:text-[#948D87]">{language === 'th' ? 'ค่าสุ่มต่อครั้ง' : 'Spin Cost'}:</span>
                  <span className="font-outfit font-extrabold text-[14px] text-[#E0533C]">{gachaCost} {t.chores.pointsUnit}</span>
                </div>
                <div className="p-2.5 rounded-[14px] bg-[#FAF7F2] dark:bg-[#262320] border border-[#E0D7D0]/60 dark:border-[#2E2A27] flex items-center justify-between">
                  <span className="text-[11.5px] text-[#8D6E63] dark:text-[#948D87]">{language === 'th' ? 'จำนวนรางวัล' : 'Prize Count'}:</span>
                  <span className="font-outfit font-extrabold text-[14px] text-[#5D4037] dark:text-[#DDD7D2]">{gachaPrizes.length} {language === 'th' ? 'รางวัล' : 'prizes'}</span>
                </div>
              </div>

              {/* Current Active Prizes List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11.5px] font-bold text-[#8D6E63] dark:text-[#948D87] px-0.5">
                  {language === 'th' ? 'รายการของรางวัลที่ใช้งานอยู่ตอนนี้:' : 'Current Active Prizes:'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto no-scrollbar">
                  {gachaPrizes.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-[12px] bg-[#FAF7F2] dark:bg-[#262320] border border-[#E0D7D0]/60 dark:border-[#2E2A27] flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-[#E0533C]/10 text-[#E0533C] font-black text-[10px] flex items-center justify-center shrink-0">
                          {p.tier}
                        </span>
                        <div className="min-w-0">
                          <div className="font-outfit font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">{p.title}</div>
                          <div className="text-[9.5px] text-[#8D6E63] dark:text-[#948D87]">{p.label}</div>
                        </div>
                      </div>
                      <span className="font-outfit font-extrabold px-2 py-0.5 rounded-full bg-[#FFF3E0] dark:bg-[#3E2514] text-[#E65100] dark:text-[#FFB74D] text-[11px] shrink-0">
                        {p.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2 rounded-[12px] bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{language === 'th' ? 'เมื่อแก้ไขการตั้งค่า ต้องได้รับการอนุมัติจากทั้งสองคนก่อนจึงจะมีผล' : 'Settings updates require approval from both partners to take effect.'}</span>
              </div>
            </div>

            {/* Approved Rewards Management List */}
            <div className="space-y-3 pt-2">
              <h3 className="font-outfit text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? `รางวัลทั้งหมดในร้านค้า (${activeShopRewards.length})` : `All Store Rewards (${activeShopRewards.length})`}
              </h3>

              {activeShopRewards.map((reward) => {
                const IconComponent = getRewardIconComponent(reward.icon);
                return (
                  <div
                    key={reward.id}
                    className="p-3.5 bg-white dark:bg-[#201D1A] border border-[#D7CCC8]/80 dark:border-[#2E2A27] rounded-[18px] flex items-center justify-between gap-3 shadow-2xs font-dm-sans"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-[12px] bg-[#FFF3E0] dark:bg-[#2B231D] flex items-center justify-center text-[#E65100] shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-outfit text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
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
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-dm-sans animate-fade-in"
            onClick={() => setIsRewardModalOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between">
                <h3 className="font-outfit text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {editingReward ? t.chores.editReward : t.chores.createReward}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsRewardModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRewardProposal} className="p-6 space-y-4 font-dm-sans">
                <div>
                  <label className="block font-dm-sans text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.rewardTitle}
                  </label>
                  <input
                    type="text"
                    required
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder={t.chores.rewardTitle}
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] font-dm-sans text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block font-dm-sans text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.rewardDesc}
                  </label>
                  <input
                    type="text"
                    value={rewardDesc}
                    onChange={(e) => setRewardDesc(e.target.value)}
                    placeholder={t.chores.rewardDesc}
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] font-dm-sans text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block font-dm-sans text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {t.chores.pointsCost}
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    required
                    value={rewardCost}
                    onChange={(e) => setRewardCost(Number(e.target.value))}
                    placeholder={t.chores.pointsCost}
                    className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] font-outfit font-bold focus:outline-hidden focus:ring-2 focus:ring-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block font-dm-sans text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1.5">
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
                          className={`p-2.5 rounded-[12px] flex flex-col items-center gap-1 border transition-all cursor-pointer font-dm-sans ${
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
                    className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] font-dm-sans text-[13px] font-bold cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingReward}
                    className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] font-dm-sans text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
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
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-dm-sans animate-fade-in"
            onClick={() => setRedeemConfirmItem(null)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl p-6 text-center animate-scale-up space-y-4 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setRedeemConfirmItem(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-14 h-14 rounded-[20px] bg-[#FFF3E0] dark:bg-[#2B231D] text-[#E65100] flex items-center justify-center mx-auto">
                <Gift className="w-8 h-8" />
              </div>

              <div>
                <h3 className="font-outfit text-[17px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.chores.redeemConfirmTitle}
                </h3>
                <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-1">
                  {t.chores.redeemConfirmDesc}
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-[#2A2724] rounded-[18px] border border-[#D7CCC8]/60 dark:border-[#3D3835] text-left font-dm-sans">
                <div className="font-outfit text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                  {redeemConfirmItem.title}
                </div>
                {redeemConfirmItem.description && (
                  <div className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] mt-0.5">
                    {redeemConfirmItem.description}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-[#D7CCC8]/40 dark:border-[#3D3835] flex items-center justify-between text-[12px]">
                  <span className="font-dm-sans text-[#8D6E63] dark:text-[#948D87]">{t.chores.cost}:</span>
                  <span className="font-outfit font-extrabold text-[15px] text-[#E0533C]">
                    {redeemConfirmItem.points_cost} {t.chores.pointsUnit}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRedeemConfirmItem(null)}
                  className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#292522] text-[#8D6E63] dark:text-[#948D87] font-dm-sans text-[13px] font-bold cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleRequestRedemption}
                  disabled={redeeming}
                  className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] font-dm-sans text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
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
        {/* ======================================================== */}
        {/* MODAL: REWARD GACHA SLOT MACHINE ANIMATION & RESULT      */}
        {/* ======================================================== */}
        {isGachaModalOpen && spinResultPrize && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3.5 sm:p-4 font-dm-sans animate-fade-in"
            onClick={() => !isPrizeSpinning && setIsGachaModalOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#1E1C1A] rounded-[28px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-2xl overflow-hidden animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Header */}
              <div className="px-5 py-3.5 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between bg-[#F4EFEA]/80 dark:bg-[#25221F]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[10px] bg-[#FFEBEE] dark:bg-[#361E1E] border border-[#FFCDD2]/60 dark:border-[#4E2727] text-[#E0533C] dark:text-[#FF8A80] flex items-center justify-center shadow-xs">
                    <Dices className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-outfit text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? 'วงล้อสุ่มของรางวัล' : 'Reward Gacha Slot'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGachaModalOpen(false)}
                  disabled={isPrizeSpinning}
                  className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-20"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 text-center">
                {/* Mode & Status Banner */}
                <div className="flex items-center justify-between px-1">
                  <span className="font-outfit text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#5D4037]/10 dark:bg-[#FFD54F]/10 text-[#5D4037] dark:text-[#FFD54F]">
                    ⭐ {language === 'th' ? `วงล้อสุ่ม ${gachaPrizes.length} รางวัล` : `${gachaPrizes.length} Prize Tiers`}
                  </span>
                  <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                    {isPrizeSpinning
                      ? language === 'th'
                        ? '🎰 กำลังหมุนลุ้น...'
                        : '🎰 Rolling...'
                      : language === 'th'
                      ? '🎉 หยุดที่รางวัลของคุณ!'
                      : '🎉 Landed on prize!'}
                  </span>
                </div>

                {/* Slot Machine Casing */}
                <div className="relative p-3.5 rounded-[22px] bg-gradient-to-b from-[#4E342E] via-[#3E2723] to-[#2B1B17] border-4 border-[#8D6E63] dark:border-[#5D4037] shadow-[0_6px_22px_rgba(0,0,0,0.4)] space-y-3">
                  {/* Top Marquee lights */}
                  <div className="flex justify-around items-center px-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          isPrizeSpinning
                            ? i % 2 === 0
                              ? 'bg-[#FFD54F] shadow-[0_0_8px_#FFD54F]'
                              : 'bg-[#FF5722] shadow-[0_0_8px_#FF5722]'
                            : gachaAnimationFinished
                            ? 'bg-[#81C784] shadow-[0_0_8px_#81C784]'
                            : 'bg-[#FFD54F] shadow-[0_0_8px_#FFD54F]'
                        }`}
                      />
                    ))}
                  </div>

                  {/* HORIZONTAL PRIZE SLOT REEL */}
                  <div
                    ref={prizeViewportRef}
                    className="relative w-full h-[90px] rounded-[18px] bg-[#1F1714] border-2 border-[#6D4C41] shadow-inner overflow-hidden flex items-center"
                  >
                    {/* Left & Right Vignette Shadows for 3D Depth */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1F1714] via-[#1F1714]/80 to-transparent z-20" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#1F1714] via-[#1F1714]/80 to-transparent z-20" />

                    {/* Top & Bottom Center Needles / Payline Pointers */}
                    <div className="pointer-events-none absolute top-0.5 left-1/2 -translate-x-1/2 z-30 text-[#FFD54F] text-[12px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
                      ▼
                    </div>
                    <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 z-30 text-[#FFD54F] text-[12px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
                      ▲
                    </div>

                    {/* Center Target Box Frame */}
                    <div
                      className={`pointer-events-none absolute left-1/2 top-1.5 bottom-1.5 -translate-x-1/2 w-[150px] rounded-[14px] border-2 z-10 transition-all duration-300 ${
                        gachaAnimationFinished
                          ? 'border-[#FFD54F] bg-[#FFD54F]/20 shadow-[0_0_14px_rgba(255,213,79,0.4)]'
                          : 'border-[#FFB74D]/60 bg-[#FFB74D]/5'
                      }`}
                    />

                    {/* Horizontal Moving Reel Track */}
                    <div
                      className="flex items-center gap-[12px] will-change-transform"
                      style={{
                        transform: `translateX(${prizeTranslateX}px)`,
                        transition: isPrizeSpinning
                          ? 'transform 4.75s cubic-bezier(0.12, 0.85, 0.22, 1)'
                          : 'none',
                      }}
                    >
                      {prizeReel.map((item, idx) => (
                        <div
                          key={idx}
                          className="w-[150px] h-[72px] shrink-0 rounded-[14px] bg-gradient-to-b from-[#342721] to-[#251B17] border border-[#5D4037] px-2.5 py-1.5 flex flex-col items-center justify-center text-center shadow-xs select-none"
                        >
                          <span className="font-outfit text-[10px] font-black text-[#FFB74D] uppercase">
                            {item.label} ({item.rate}%)
                          </span>
                          <span className="font-outfit font-bold text-[13px] text-[#FDFBF7] line-clamp-2 leading-tight mt-0.5">
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Slot Machine Bottom Base */}
                  <div className="pt-0.5 flex items-center justify-between px-1 text-[10px] text-[#D7CCC8]">
                    <span className="flex items-center gap-1 font-outfit">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD54F]" />
                      <span>{gachaAnimationFinished ? 'CONGRATULATIONS' : 'BOBBIES REWARD REEL'}</span>
                    </span>
                    <span className="font-outfit font-bold tracking-wider text-[#FFD54F]">
                      EXTENDED SUSPENSE
                    </span>
                  </div>
                </div>

                {/* State-dependent result / spinning text */}
                {isPrizeSpinning ? (
                  <div className="py-2 flex flex-col items-center justify-center gap-1 animate-pulse">
                    <span className="font-outfit font-bold text-[14px] text-[#E65100] dark:text-[#FFB74D]">
                      🎰 {language === 'th' ? 'กำลังสุ่มแบบลุ้นยาวพิเศษ... ขอให้ได้รางวัลใหญ่!' : 'Spinning with excitement... Good luck!'}
                    </span>
                    <span className="font-dm-sans text-[11.5px] text-[#8D6E63] dark:text-[#DDD7D2]/80">
                      {language === 'th' ? 'วงล้อหมุนนานขึ้นเป็นพิเศษเพื่อความตื่นเต้น!' : 'Extended suspense spin for max excitement!'}
                    </span>
                  </div>
                ) : gachaAnimationFinished ? (
                  <div className="space-y-3 animate-scale-up">
                    <div className="p-3.5 rounded-[20px] bg-gradient-to-b from-[#FFFDE7]/90 to-[#FFF8E1]/90 dark:from-[#25201B] dark:to-[#1F1B17] border border-[#FFE082] dark:border-[#534323] shadow-xs">
                      <span className="font-dm-sans text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#E8F5E9] dark:bg-[#1B3E22]/60 text-[#2E7D32] dark:text-[#81C784] border border-[#81C784]/40">
                        {language === 'th' ? '🎉 ยินดีด้วย! คุณได้รับรางวัล' : '🎉 Congratulations! You won:'}
                      </span>

                      <div className="mt-1.5 font-outfit text-[11px] font-black text-[#E65100] dark:text-[#FFB74D] uppercase">
                        {spinResultPrize.prize.label} (โอกาส {spinResultPrize.prize.rate}%)
                      </div>

                      <h4 className="font-outfit text-[18px] font-extrabold text-[#5D4037] dark:text-[#FDFBF7] mt-1 line-clamp-2">
                        {spinResultPrize.prize.title}
                      </h4>

                      <p className="font-dm-sans text-[11.5px] text-[#8D6E63] dark:text-[#DDD7D2]/80 mt-1">
                        {language === 'th'
                          ? 'สามารถขอแลกหรือเคลมรางวัลนี้กับแฟน/คนในบ้านได้เลย!'
                          : 'Claim or redeem this prize with your partner!'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsGachaModalOpen(false);
                          setTimeout(() => handleSpinRewardGacha(), 200);
                        }}
                        disabled={myPoints < gachaCost}
                        className="flex-1 py-2.5 rounded-[14px] bg-gradient-to-r from-[#E65100] to-[#FFA000] text-white font-outfit text-[13px] font-bold hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-40"
                      >
                        {language === 'th' ? `🎰 สุ่มอีกครั้ง (${gachaCost} pt)` : `Spin Again (${gachaCost} pt)`}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsGachaModalOpen(false)}
                        className="flex-1 py-2.5 rounded-[14px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] font-dm-sans text-[13px] font-bold hover:opacity-90 transition-all cursor-pointer shadow-xs"
                      >
                        {language === 'th' ? 'เสร็จสิ้น / ปิด' : 'Close'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: CONFIGURE GACHA PRIZES & RATES (%)               */}
        {/* ======================================================== */}
        {isGachaConfigModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3.5 sm:p-4 font-dm-sans animate-fade-in"
            onClick={() => setIsGachaConfigModalOpen(false)}
          >
            <div 
              className="w-full max-w-md bg-[#FDFBF7] dark:bg-[#1E1C1A] rounded-[28px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between bg-[#F4EFEA]/80 dark:bg-[#25221F] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[10px] bg-[#FFEBEE] dark:bg-[#361E1E] border border-[#FFCDD2]/60 dark:border-[#4E2727] text-[#E0533C] dark:text-[#FF8A80] flex items-center justify-center shadow-xs">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-outfit text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? 'ตั้งค่าของรางวัลและเรทวงล้อสุ่ม' : 'Configure Gacha Prizes & Rates'}
                    </h3>
                    <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      {language === 'th'
                        ? 'กำหนดจำนวนรางวัล (2-10 รางวัล) ชื่อรางวัล และ % เรท (ต้องอนุมัติ 2 คน)'
                        : 'Set prize count (2-10), names & rates (dual approval)'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGachaConfigModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body: Inputs */}
              <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
                {/* Cost configuration field */}
                <div className="p-3 bg-white dark:bg-[#262320] rounded-[16px] border border-[#D7CCC8]/60 dark:border-[#332E2A] flex items-center justify-between gap-3">
                  <div>
                    <div className="font-outfit text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? 'คะแนนที่ใช้สุ่มต่อครั้ง' : 'Points Cost per Spin'}
                    </div>
                    <div className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      {language === 'th' ? 'ใส่ 0 หากต้องการให้สุ่มฟรี' : 'Set to 0 for free spins'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={draftGachaCost}
                      onChange={(e) => setDraftGachaCost(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 px-2.5 py-1.5 rounded-[10px] bg-[#FAF7F2] dark:bg-[#1A1816] border border-[#D7CCC8] dark:border-[#3D3835] font-outfit font-extrabold text-[14px] text-center text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:ring-1 focus:ring-[#E0533C]"
                    />
                    <span className="font-dm-sans text-[12px] font-semibold text-[#8D6E63] dark:text-[#948D87]">
                      {t.chores.pointsUnit}
                    </span>
                  </div>
                </div>

                {/* Prize Count & Auto-Balance Controls */}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-outfit text-[12.5px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                    {language === 'th'
                      ? `จำนวนของรางวัล (${draftConfigPrizes.length} รางวัล)`
                      : `Prize Count (${draftConfigPrizes.length})`}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAutoBalanceRates}
                      className="px-2.5 py-1 rounded-[10px] bg-[#F4EFEA] dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[11px] font-bold text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] dark:hover:text-white cursor-pointer transition-colors"
                      title="เฉลี่ย % ให้เท่ากันอัตโนมัติ"
                    >
                      {language === 'th' ? 'เฉลี่ยเรทเท่ากัน' : 'Equalize Rates'}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddPrizeTier}
                      disabled={draftConfigPrizes.length >= 10}
                      className="px-2.5 py-1 rounded-[10px] bg-[#E0533C] text-white text-[11px] font-bold hover:brightness-105 disabled:opacity-40 cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{language === 'th' ? 'เพิ่มรางวัล' : 'Add Prize'}</span>
                    </button>
                  </div>
                </div>

                {/* Total % Rate Checker Banner */}
                {(() => {
                  const currentTotal = draftConfigPrizes.reduce((sum, p) => sum + (Number(p.rate) || 0), 0);
                  const isExactly100 = currentTotal === 100;
                  return (
                    <div
                      className={`p-2.5 rounded-[14px] border flex items-center justify-between text-[12px] font-outfit font-bold ${
                        isExactly100
                          ? 'bg-[#E8F5E9] dark:bg-[#1B3E22]/50 border-[#81C784]/60 text-[#2E7D32] dark:text-[#81C784]'
                          : 'bg-[#FFEBEE] dark:bg-[#3D1F1F] border-[#EF9A9A] text-[#C62828] dark:text-[#EF9A9A]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isExactly100 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span>{language === 'th' ? 'ผลรวมโอกาสการออกรางวัล:' : 'Total Rate Sum:'}</span>
                      </span>
                      <span className="text-[14px] font-black">
                        {currentTotal}% / 100% {currentTotal !== 100 && `(ขาด/เกิน ${100 - currentTotal}%)`}
                      </span>
                    </div>
                  );
                })()}

                {/* List of Tiers */}
                <div className="space-y-2.5">
                  {draftConfigPrizes.map((tierItem, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white dark:bg-[#25221F] rounded-[18px] border border-[#D7CCC8]/70 dark:border-[#332E2A] space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="font-outfit w-5 h-5 rounded-full bg-[#E0533C]/10 text-[#E0533C] text-[11px] font-black flex items-center justify-center shrink-0">
                            {tierItem.tier}
                          </span>
                          <input
                            type="text"
                            value={tierItem.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftConfigPrizes((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], label: val };
                                return next;
                              });
                            }}
                            className="font-outfit text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] bg-transparent border-none focus:outline-none w-28 sm:w-36 truncate"
                            placeholder={`รางวัลที่ ${tierItem.tier}`}
                          />
                        </div>

                        {/* Rate % Input & Delete button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                            {language === 'th' ? 'เรท:' : 'Rate:'}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tierItem.rate}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDraftConfigPrizes((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], rate: val };
                                return next;
                              });
                            }}
                            className="w-16 px-2 py-1 rounded-[8px] bg-[#FAF7F2] dark:bg-[#1A1816] border border-[#D7CCC8] dark:border-[#3D3835] font-outfit font-bold text-[13px] text-center text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:ring-1 focus:ring-[#E0533C]"
                          />
                          <span className="font-outfit text-[12px] font-extrabold text-[#E0533C]">%</span>

                          {draftConfigPrizes.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePrizeTier(index)}
                              className="p-1 text-[#8D6E63] hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer ml-1 transition-colors"
                              title={language === 'th' ? 'ลบรางวัลนี้' : 'Remove tier'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Prize Title input */}
                      <input
                        type="text"
                        value={tierItem.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftConfigPrizes((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], title: val };
                            return next;
                          });
                        }}
                        placeholder={language === 'th' ? 'พิมพ์ชื่อของรางวัล (เช่น ดินเนอร์มื้อโปรด, ช้อปปิ้ง)...' : 'Enter prize title...'}
                        className="w-full px-3 py-2 rounded-[12px] bg-[#FAF7F2] dark:bg-[#1A1816] border border-[#D7CCC8] dark:border-[#3D3835] font-dm-sans text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:ring-1 focus:ring-[#E0533C]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#D7CCC8]/60 dark:border-[#2E2A27] bg-[#F4EFEA]/80 dark:bg-[#25221F] flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGachaConfigModalOpen(false)}
                  disabled={savingGachaConfig}
                  className="flex-1 py-2.5 rounded-[14px] bg-white dark:bg-[#2A2724] border border-[#D7CCC8] dark:border-[#3D3835] text-[#8D6E63] dark:text-[#948D87] font-dm-sans text-[13px] font-bold hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitGachaConfigProposal}
                  disabled={savingGachaConfig}
                  className="flex-1 py-2.5 rounded-[14px] bg-[#E0533C] text-white font-dm-sans text-[13px] font-bold hover:brightness-105 cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {savingGachaConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      {members.length > 1 ? <ShieldCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      <span>
                        {members.length > 1
                          ? language === 'th'
                            ? 'ส่งคำขอแก้ไข (รอแฟนอนุมัติ)'
                            : 'Propose (Waiting Partner)'
                          : language === 'th'
                          ? 'บันทึกการตั้งค่า'
                          : 'Save Configuration'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: VIEW ALL GACHA PRIZES (FOR SHOP TAB)              */}
        {/* ======================================================== */}
        {isViewPrizesModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-dm-sans animate-fade-in"
            onClick={() => setIsViewPrizesModalOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between bg-[#F4EFEA]/80 dark:bg-[#25221F] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[10px] bg-[#FFEBEE] dark:bg-[#361E1E] border border-[#FFCDD2]/60 dark:border-[#4E2727] text-[#E0533C] dark:text-[#FF8A80] flex items-center justify-center shadow-xs">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-outfit text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? `ของรางวัลทั้งหมด (${gachaPrizes.length} รางวัล)` : `Prize Pool (${gachaPrizes.length} Prizes)`}
                    </h3>
                    <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      {language === 'th' ? `ค่าสุ่มครั้งละ ${gachaCost} คะแนน` : `Cost per spin: ${gachaCost} pts`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsViewPrizesModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Prize List */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1">
                {gachaPrizes.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-[#2A2724] rounded-[16px] border border-[#D7CCC8]/60 dark:border-[#3D3835] flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="font-outfit w-6 h-6 rounded-full bg-[#E0533C]/10 text-[#E0533C] text-[11px] font-black flex items-center justify-center shrink-0">
                        {p.tier}
                      </span>
                      <div className="min-w-0">
                        <div className="font-outfit text-[13.5px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate">
                          {p.title}
                        </div>
                        <div className="font-dm-sans text-[10.5px] text-[#8D6E63] dark:text-[#948D87]">
                          {p.label}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-outfit text-[12px] font-black px-2.5 py-0.5 rounded-full bg-[#FFF3E0] dark:bg-[#3E2514] text-[#E65100] dark:text-[#FFB74D]">
                        {p.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-3.5 border-t border-[#D7CCC8]/60 dark:border-[#2E2A27] bg-[#F4EFEA]/80 dark:bg-[#25221F] shrink-0">
                <button
                  type="button"
                  onClick={() => setIsViewPrizesModalOpen(false)}
                  className="w-full py-2 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] font-dm-sans text-[12.5px] font-bold hover:opacity-90 transition-all cursor-pointer shadow-xs"
                >
                  {language === 'th' ? 'ปิด' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: GACHA HISTORY / REWARD LOGS                       */}
        {/* ======================================================== */}
        {isGachaHistoryModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-dm-sans animate-fade-in"
            onClick={() => setIsGachaHistoryModalOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xl overflow-hidden animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[#D7CCC8]/60 dark:border-[#2E2A27] flex items-center justify-between">
                <h3 className="font-outfit text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#5D4037] dark:text-[#DDD7D2]" />
                  <span>{language === 'th' ? 'ประวัติการสุ่มรางวัล' : 'Reward Spin History'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsGachaHistoryModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 max-h-[360px] overflow-y-auto space-y-2 font-dm-sans">
                {gachaHistory.length === 0 ? (
                  <p className="font-dm-sans text-[12px] text-center text-[#8D6E63] dark:text-[#948D87] py-8">
                    {language === 'th' ? 'ยังไม่มีประวัติการสุ่มรางวัล' : 'No spin history yet'}
                  </p>
                ) : (
                  gachaHistory.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-white dark:bg-[#2A2724] rounded-[16px] border border-[#D7CCC8]/60 dark:border-[#3D3835] flex items-center justify-between gap-2 font-dm-sans shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-outfit text-[10px] font-black px-1.5 py-0.2 rounded-full bg-[#5D4037]/10 dark:bg-[#FFD54F]/20 text-[#5D4037] dark:text-[#FFD54F]">
                            {s.prize.label}
                          </span>
                          <span className="font-dm-sans text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                            {new Date(s.date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}
                          </span>
                        </div>
                        <div className="font-outfit text-[13px] font-bold text-[#5D4037] dark:text-[#DDD7D2] truncate mt-0.5">
                          {s.prize.title}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-outfit text-[11px] font-black text-[#E65100] dark:text-[#FFB74D]">
                          {s.prize.rate}%
                        </span>
                        <div className="text-[10px] font-dm-sans text-[#8D6E63] dark:text-[#948D87]">
                          -{s.pointsSpent} pt
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Deletions */}
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
