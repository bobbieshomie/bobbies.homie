'use client';

import { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Wallet, 
  ShoppingCart, 
  PawPrint, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  UserPlus, 
  Coins, 
  ChevronRight, 
  Check,
  CheckSquare,
  Gift,
  History,
  HelpCircle,
  Trophy,
  Zap,
  Loader2,
  X,
  Dice5
} from 'lucide-react';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { useLanguage } from '@/lib/i18n/language-context';
import { RiBearSmileFill } from '@remixicon/react';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { 
  fetchProfile, 
  fetchHousehold, 
  fetchHouseholdMembers, 
  fetchChores, 
  fetchShoppingLists, 
  fetchPets, 
  fetchFinances,
  fetchUserChorePoints,
  toggleChoreWithPoints,
  fetchChoreGachaSpins,
  fetchMyActiveGachaSpin,
  spinChoreGacha,
  getWeekIdentifier,
  type DbProfile,
  type DbChoreGachaSpin
} from '@/lib/services/db';

export default function DashboardPage() {
  const { t, formatCurrentDate, language } = useLanguage();

  // Real store data
  const chores = useAppStore((state) => state.chores);
  const setStoreChores = useAppStore((state) => state.setChores);
  const shoppingItems = useAppStore((state) => state.shoppingItems);
  const expenses = useAppStore((state) => state.expenses);
  const petRecords = useAppStore((state) => state.petRecords);
  const profile = useAppStore((state) => state.profile);
  const updateProfile = useAppStore((state) => state.updateProfile);

  // Dynamic household members
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [activeUserAvatar, setActiveUserAvatar] = useState<string | null>(profile.myAvatarUrl || null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [myChorePoints, setMyChorePoints] = useState<number>(0);
  const [togglingChoreId, setTogglingChoreId] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(0);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

  // Mystery Box / Gacha State
  const [activeGachaSpin, setActiveGachaSpin] = useState<DbChoreGachaSpin | null>(null);
  const [gachaHistory, setGachaHistory] = useState<DbChoreGachaSpin[]>([]);
  const [isGachaModalOpen, setIsGachaModalOpen] = useState(false);
  const [isGachaHistoryModalOpen, setIsGachaHistoryModalOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<{ chore_title: string; multiplier: number } | null>(null);

  // Household dual member avatars
  const currentMember = useMemo(() => {
    return members.find((m) => m.id === currentUserId) || (currentUserId ? ({
      id: currentUserId,
      full_name: profile.name,
      nickname: profile.myNickname,
      avatar_url: activeUserAvatar,
    } as DbProfile) : null);
  }, [members, currentUserId, profile, activeUserAvatar]);

  const partnerMember = useMemo(() => {
    return members.find((m) => m.id !== currentUserId) || (members.length > 1 ? members[1] : null);
  }, [members, currentUserId]);

  // Nudge cooldown countdown
  useEffect(() => {
    if (nudgeCooldown <= 0) return;
    const timer = setInterval(() => {
      setNudgeCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [nudgeCooldown]);

  // Load real data from Supabase on mount
  useEffect(() => {
    async function syncDashboard() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const p = await fetchProfile(user.id);
          if (p) {
            updateProfile({
              name: p.full_name,
              myNickname: p.nickname || p.full_name,
              myAvatarUrl: p.avatar_url,
              myBio: p.bio || '',
            });
            setActiveUserAvatar(p.avatar_url);

            const pts = await fetchUserChorePoints(user.id);
            setMyChorePoints(pts);

            const activeSpin = await fetchMyActiveGachaSpin(user.id);
            setActiveGachaSpin(activeSpin);

            if (p.household_id) {
              setHouseholdId(p.household_id);
              const h = await fetchHousehold(p.household_id);
              if (h) {
                updateProfile({
                  name: h.name,
                  inviteCode: h.invite_code,
                });
              }
              const mems = await fetchHouseholdMembers(p.household_id);
              setMembers(mems);

              const chs = await fetchChores(p.household_id);
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

              const allSpins = await fetchChoreGachaSpins(p.household_id);
              setGachaHistory(allSpins);
            }
          }
        }
      } catch (err) {
        console.warn('Dashboard sync notice:', err);
      }
    }

    syncDashboard();
  }, [updateProfile, setStoreChores]);

  // Quick toggle chore from Dashboard
  const handleQuickToggleChore = async (choreId: string, currentStatus: boolean) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }
    const nextCompleted = !currentStatus;
    setTogglingChoreId(choreId);

    // Optimistic store update
    setStoreChores(
      chores.map((c) => (c.id === choreId ? { ...c, isCompleted: nextCompleted } : c))
    );

    try {
      const res = await toggleChoreWithPoints(choreId, nextCompleted);
      if (res.success) {
        setMyChorePoints(res.new_balance);

        // Refresh active spin if bonus was used
        if (nextCompleted && res.multiplier && res.multiplier > 1 && currentUserId) {
          fetchMyActiveGachaSpin(currentUserId).then((updated) => {
            if (updated) setActiveGachaSpin(updated);
          });
        }
      }
    } catch (err) {
      console.error('Failed to toggle chore from dashboard:', err);
      // Revert if error
      if (householdId) {
        fetchChores(householdId).then((chs) => {
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
        });
      }
    } finally {
      setTogglingChoreId(null);
    }
  };

  // Spin Mystery Box
  const handleSpinGacha = async () => {
    if (!householdId || !currentUserId) return;
    if (myChorePoints < 10) {
      alert(language === 'th' ? 'คะแนนสะสมไม่พอ (ต้องใช้ 10 คะแนนในการสุ่ม)' : 'Not enough points (10 pts required)');
      return;
    }
    if (activeGachaSpin) {
      alert(language === 'th' ? 'คุณสุ่มกล่องปริศนาในสัปดาห์นี้ไปแล้ว! (สุ่มได้อีกครั้งในสัปดาห์หน้า)' : 'You already spun this week!');
      return;
    }

    setIsSpinning(true);
    setSpinResult(null);

    try {
      // Pick random chore from chore list or fallback
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

      // Multipliers: x1.5 (35%), x2 (40%), x2.5 (15%), x3 (8%), x5 (2% jackpot!)
      const multipliers = [1.5, 2, 2, 2, 2.5, 3, 5];
      const pickedMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];

      // Suspense delay
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
          setMyChorePoints(res.new_balance);
        }

        // Refresh active spin and history
        const active = await fetchMyActiveGachaSpin(currentUserId);
        setActiveGachaSpin(active);
        const hist = await fetchChoreGachaSpins(householdId);
        setGachaHistory(hist);

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
            link: '/dashboard',
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
      setIsSpinning(false);
    }
  };

  const handleNudge = async () => {
    if (!householdId || !currentUserId || nudgeCooldown > 0) return;
    setNudgeLoading(true);
    setNudgeMessage(null);
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      const sender = profile.myNickname || profile.name || (language === 'th' ? 'คนในบ้าน' : 'Homie');
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          excludeUserId: currentUserId,
          title: '🐻 Bobbies Homie',
          body: language === 'th'
            ? `${sender} สะกิดคุณ! 👋 มีอะไรหรือเปล่านะ~`
            : `${sender} nudged you! 👋 Check in on homie!`,
          link: '/dashboard',
        }),
      });
      const data = await res.json();
      if (data.success || data.tokensCount > 0) {
        setNudgeCooldown(10);
        setNudgeMessage(language === 'th' ? 'สะกิดเรียบร้อย! ✨' : 'Nudge sent! ✨');
      } else {
        setNudgeMessage(language === 'th' ? 'อีกฝ่ายยังไม่ได้เปิดแจ้งเตือน' : 'Partner has not enabled push yet');
      }
    } catch {
      setNudgeMessage(language === 'th' ? 'ส่งไม่สำเร็จ' : 'Failed to send');
    } finally {
      setNudgeLoading(false);
    }
  };

  // Dynamic greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t.dashboard.goodMorning;
    if (hour < 17) return t.dashboard.goodAfternoon;
    return t.dashboard.goodEvening;
  }, [t]);

  // Real chores statistics
  const choreStats = useMemo(() => {
    const total = chores.length;
    if (total === 0) {
      return { completed: 0, total: 0, percent: 0 };
    }
    const completed = chores.filter((c) => c.isCompleted).length;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  }, [chores]);

  // Real unpurchased shopping items count
  const shoppingCount = useMemo(() => {
    return shoppingItems.filter((i) => !i.isPurchased).length;
  }, [shoppingItems]);

  // Real next pet event
  const nextPetEvent = useMemo(() => {
    const upcoming = petRecords.find((r) => r.status === 'upcoming');
    return upcoming || null;
  }, [petRecords]);

  // Real finances net balance
  const financeBalance = useMemo(() => {
    const totalUnsettled = expenses
      .filter((e) => e.status !== 'resolved')
      .reduce((sum, e) => sum + e.amount, 0);
    return totalUnsettled / 2;
  }, [expenses]);

  return (
    <div className="flex flex-col items-center bg-[#FDFBF7] dark:bg-[#1A1816] min-h-screen select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-28 transition-colors duration-200">
      <div className="flex flex-col items-start p-0 gap-6 w-full flex-none order-0 self-stretch flex-grow-0">
        
        {/* header */}
        <header className="header box-border flex flex-col items-start px-6 pt-5 pb-0 gap-3 w-full bg-transparent flex-none order-0 self-stretch flex-grow-0">
          <div className="flex flex-row justify-between items-center p-0 w-full">
            <div className="welcome-text flex flex-col items-start p-0 gap-1 flex-1">
              <span className="font-dm-sans font-medium text-[13px] leading-[17px] text-[#8D6E63] dark:text-[#948D87] tracking-wide">
                {formatCurrentDate()}
              </span>
              <h1 className="font-outfit font-extrabold text-[24px] leading-[30px] text-[#5D4037] dark:text-[#DDD7D2]">
                {greeting}, {profile.myNickname || profile.name}!
              </h1>
            </div>

            {/* Top Right Header Action: Notification Bell & Dual Avatars */}
            <div className="flex items-center gap-2.5">
              <NotificationBell />

              <Link
                href="/profile"
                className="group flex items-center p-1 rounded-full bg-[#F4EFEA] dark:bg-[#25201D] border border-[#D7CCC8]/80 dark:border-[#3E322A] hover:border-[#8D6E63] transition-all shadow-xs"
                title={language === 'th' ? 'ข้อมูลบัญชี & สมาชิกในบ้าน' : 'Account & Household'}
              >
                {/* User Avatar */}
                <div className="relative w-[36px] h-[36px] rounded-full bg-[#5D4037] text-white border-2 border-[#FDFBF7] dark:border-[#1A1816] shadow-xs z-10 overflow-hidden flex items-center justify-center shrink-0">
                  {activeUserAvatar ? (
                    <img 
                      src={activeUserAvatar} 
                      alt={profile.myNickname || profile.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="font-outfit font-bold text-[13px]">
                      {(profile.myNickname || profile.name || 'M').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Partner Avatar */}
                {partnerMember ? (
                  <div 
                    title={partnerMember.nickname || partnerMember.full_name || 'Partner'}
                    className="relative w-[36px] h-[36px] -ml-[12px] rounded-full bg-[#E8DFD8] dark:bg-[#3E322A] border-2 border-[#FDFBF7] dark:border-[#1A1816] shadow-sm z-20 overflow-hidden flex items-center justify-center shrink-0 text-[#8D6E63] dark:text-[#DDD7D2]"
                  >
                    {partnerMember.avatar_url ? (
                      <img 
                        src={partnerMember.avatar_url} 
                        alt={partnerMember.nickname || 'Partner'} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="font-outfit font-bold text-[13px]">
                        {(partnerMember.nickname || partnerMember.full_name || 'P').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div 
                    title={language === 'th' ? 'เพิ่มสมาชิกในบ้าน' : 'Add member'}
                    className="w-[28px] h-[28px] -ml-[8px] rounded-full bg-[#F4EFEA] dark:bg-[#25201D] border-2 border-[#FDFBF7] dark:border-[#1A1816] flex items-center justify-center shadow-xs z-20 text-[#8D6E63] dark:text-[#948D87]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                )}
              </Link>
            </div>
          </div>

          {/* Quick Nudge Action Button */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={nudgeLoading || nudgeCooldown > 0}
              onClick={handleNudge}
              title={language === 'th' ? 'กดสะกิดแฟนหรือคนในบ้าน' : 'Nudge household members'}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFEA] hover:bg-[#EAE4DC] dark:bg-[#25201D] dark:hover:bg-[#2F2722] border border-[#D7CCC8]/80 dark:border-[#3E322A] text-xs font-semibold text-[#5D4037] dark:text-[#DDD7D2] shadow-xs active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-75"
            >
              <span className={`text-xs transition-transform duration-300 ${nudgeCooldown > 0 ? 'scale-125' : ''}`}>
                👋
              </span>
              <span>
                {nudgeCooldown > 0
                  ? (language === 'th' ? `สะกิดแล้ว (${nudgeCooldown}s)` : `Nudged (${nudgeCooldown}s)`)
                  : nudgeLoading
                  ? (language === 'th' ? 'กำลังสะกิด...' : 'Nudging...')
                  : (language === 'th' ? 'สะกิดคนในบ้าน' : 'Nudge Homie')}
              </span>
            </button>

            {nudgeMessage && (
              <span className="text-[11px] text-[#2E7D32] dark:text-[#81C784] font-medium animate-in fade-in">
                {nudgeMessage}
              </span>
            )}
          </div>
        </header>

        {/* dashboard-body */}
        <main className="dashboard-body flex flex-col items-start px-6 p-0 gap-4 w-full flex-none order-2 self-stretch flex-grow-0">
          
          {/* ======================================================== */}
          {/* 1. CHORE CARD: กล่องยาวแต่ไม่สูง (ตามคำขอ)                 */}
          {/* ======================================================== */}
          <section className="w-full p-4 rounded-[22px] bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] transition-colors">
            {/* Top row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[10px] bg-[#2E7D32]/15 dark:bg-[#1B5E20]/40 flex items-center justify-center text-[#2E7D32] dark:text-[#81C784]">
                  <CheckSquare className="w-4 h-4 stroke-[2.2]" />
                </div>
                <h2 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.dashboard.todayChores}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#C8E6C9] dark:bg-[#1B5E20]/40 text-[#2E7D32] dark:text-[#81C784] text-[11px] font-bold">
                  {choreStats.completed}/{choreStats.total} ({choreStats.percent}%)
                </span>
                <Link
                  href="/chores"
                  className="text-[12px] font-bold text-[#2E7D32] dark:text-[#81C784] hover:underline flex items-center gap-0.5 ml-1"
                >
                  <span>จัดการ</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Slim Horizontal Progress Bar */}
            <div className="w-full h-2 rounded-full bg-[#E8DFD8] dark:bg-[#2E2A27] overflow-hidden mb-2.5">
              <div
                className="h-full bg-[#2E7D32] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${choreStats.percent}%` }}
              />
            </div>

            {/* Compact Chore Checklist */}
            {chores.length === 0 ? (
              <div className="text-center py-1">
                <Link href="/chores" className="text-[12px] text-[#2E7D32] font-semibold hover:underline">
                  + {t.dashboard.addChorePrompt}
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {chores.slice(0, 2).map((chore) => {
                  const hasBonus = activeGachaSpin && chore.title.toLowerCase().includes(activeGachaSpin.chore_title.toLowerCase());
                  return (
                    <div
                      key={chore.id}
                      onClick={() => handleQuickToggleChore(chore.id, chore.isCompleted)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-[12px] bg-white/70 dark:bg-[#141312]/60 hover:bg-white dark:hover:bg-[#141312] border border-[#D7CCC8]/50 dark:border-[#2E2A27]/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`w-4 h-4 rounded-[6px] flex items-center justify-center border transition-all shrink-0 ${
                            chore.isCompleted
                              ? 'bg-[#2E7D32] border-[#2E7D32] text-white'
                              : 'border-[#D7CCC8] dark:border-[#5D4037]'
                          }`}
                        >
                          {chore.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className={`text-[12px] font-semibold truncate ${
                            chore.isCompleted
                              ? 'line-through text-[#8D6E63]/60 dark:text-[#948D87]/60'
                              : 'text-[#5D4037] dark:text-[#DDD7D2]'
                          }`}
                        >
                          {chore.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {hasBonus && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#FFF3E0] text-[#E65100] text-[9px] font-extrabold animate-pulse">
                            x{activeGachaSpin.multiplier} 🔥
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-[#2E7D32] dark:text-[#81C784]">
                          +{hasBonus ? Math.round(chore.points * activeGachaSpin.multiplier) : chore.points} ⭐
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* 2. REWARD SHOP BANNER (แยกขาดจากงานบ้านตามคำขอ)             */}
          {/* ======================================================== */}
          <section className="w-full p-3.5 rounded-[22px] bg-gradient-to-r from-[#F4EFEA] to-[#ECE5DC] dark:from-[#24211E] dark:to-[#1C1A18] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-[14px] bg-[#5D4037] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Gift className="w-5 h-5 text-[#F2C94C]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-outfit font-bold text-[14px] text-[#5D4037] dark:text-[#DDD7D2]">
                    {language === 'th' ? 'ร้านค้าแลกรางวัล' : 'Reward Shop'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#5D4037] text-white text-[10px] font-extrabold flex items-center gap-1">
                    <Coins className="w-2.5 h-2.5 text-[#F2C94C]" />
                    <span>{myChorePoints} คะแนน</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate mt-0.5">
                  {partnerMember
                    ? `${partnerMember.nickname || partnerMember.full_name} มี ${partnerMember.chore_points || 0} คะแนน`
                    : 'ใช้คะแนนสะสมแลกของรางวัลในบ้าน'}
                </p>
              </div>
            </div>

            <Link
              href="/chores?tab=rewards"
              className="shrink-0 px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] text-[12px] font-bold hover:opacity-90 shadow-2xs flex items-center gap-1"
            >
              <span>{language === 'th' ? 'ไปร้านค้า' : 'Shop'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </section>

          {/* ======================================================== */}
          {/* 3. WEEKLY MYSTERY BOX / GACHA CARD (กล่องสุ่มงานบ้าน x ตัวคูณ)*/}
          {/* ======================================================== */}
          <section className="w-full p-3.5 rounded-[22px] bg-gradient-to-br from-[#FFF9E6] to-[#FDF3D8] dark:from-[#292218] dark:to-[#1E1912] border-2 border-[#F2C94C]/70 dark:border-[#F2C94C]/40 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-[#E65100] to-[#F2C94C] text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                  <Dice5 className="w-5 h-5 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-outfit font-extrabold text-[14px] text-[#5D4037] dark:text-[#DDD7D2]">
                      {language === 'th' ? 'กล่องสุ่มงานบ้าน x ตัวคูณ' : 'Weekly Mystery Box'}
                    </span>
                    {activeGachaSpin && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#2E7D32] text-white text-[9px] font-extrabold">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {activeGachaSpin ? (
                    <div className="mt-0.5">
                      <p className="text-[11px] font-bold text-[#E65100] dark:text-[#FFB74D] truncate">
                        🌟 สัปดาห์นี้: {activeGachaSpin.chore_title} (คูณ x{activeGachaSpin.multiplier})
                      </p>
                      <p className="text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                        ทำงานนี้จะได้รับคะแนนคูณทันที! (ใช้แล้ว {activeGachaSpin.times_used} ครั้ง)
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate mt-0.5">
                      สุ่มได้ 1 ครั้ง/สัปดาห์ (ใช้ 10 คะแนน) ลุ้นคูณ x1.5 ถึง x5! 🎁
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGachaHistoryModalOpen(true)}
                  title="ดูประวัติการสุ่ม"
                  className="p-2 rounded-[12px] bg-white/80 dark:bg-[#1A1816]/80 text-[#8D6E63] dark:text-[#948D87] border border-[#D7CCC8]/60 dark:border-[#2E2A27] hover:bg-white transition-colors cursor-pointer"
                >
                  <History className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsGachaModalOpen(true)}
                  className={`px-3 py-2 rounded-[12px] text-[12px] font-extrabold flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer ${
                    activeGachaSpin
                      ? 'bg-[#E8F5E9] dark:bg-[#1B5E20]/40 text-[#2E7D32] dark:text-[#81C784] border border-[#2E7D32]/30'
                      : 'bg-gradient-to-r from-[#E65100] to-[#F2C94C] text-white hover:opacity-95'
                  }`}
                >
                  {activeGachaSpin ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>สุ่มแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>เปิดกล่อง</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* summaries-grid */}
          <section className="summaries-grid flex flex-row items-start p-0 gap-3 w-full flex-none order-1 self-stretch flex-grow-0">
            {/* shopping-summary */}
            <Link
              href="/shopping"
              className="shopping-summary box-border flex flex-col items-start p-4 gap-3 flex-1 h-[123px] bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] flex-none order-0 self-stretch flex-grow-1 transition-transform active:scale-[0.98]"
            >
              <div className="card-header flex flex-row justify-between items-center p-0 w-full h-[32px]">
                <div className="icon-wrap flex flex-row justify-center items-center w-[32px] h-[32px] bg-[#C8E6C9] dark:bg-[#1B5E20]/40 rounded-[16px]">
                  <ShoppingCart className="w-4 h-4 stroke-[#2E7D32] dark:stroke-[#81C784]" strokeWidth={2.2} />
                </div>
              </div>

              <div className="flex flex-col items-start p-0 gap-0.5 w-full">
                <span className="font-outfit font-bold text-[20px] leading-[26px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {shoppingCount} {t.common.items}
                </span>
                <span className="font-dm-sans font-normal text-[12px] leading-[16px] text-[#8D6E63] dark:text-[#948D87] truncate w-full">
                  {shoppingCount > 0 ? t.dashboard.inSharedList : t.dashboard.noShoppingItems}
                </span>
              </div>
            </Link>

            {/* pet-summary */}
            <Link
              href="/pets"
              className="pet-summary box-border flex flex-col items-start p-4 gap-3 flex-1 h-[123px] bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] flex-none order-1 self-stretch flex-grow-1 transition-transform active:scale-[0.98]"
            >
              <div className="card-header flex flex-row justify-between items-center p-0 w-full h-[32px]">
                <div className="icon-wrap flex flex-row justify-center items-center w-[32px] h-[32px] bg-[#FFE0B2] dark:bg-[#E65100]/30 rounded-[16px]">
                  <PawPrint className="w-4 h-4 stroke-[#E65100] dark:stroke-[#FFB74D]" strokeWidth={2.2} />
                </div>
              </div>

              <div className="flex flex-col items-start p-0 gap-0.5 w-full">
                <span className="font-outfit font-bold text-[16px] leading-[22px] text-[#5D4037] dark:text-[#DDD7D2] truncate w-full">
                  {nextPetEvent ? nextPetEvent.title : t.dashboard.petSummaryTitle}
                </span>
                <span className="font-dm-sans font-normal text-[12px] leading-[16px] text-[#8D6E63] dark:text-[#948D87] truncate w-full">
                  {nextPetEvent ? nextPetEvent.dateText : t.dashboard.noPetEvents}
                </span>
              </div>
            </Link>
          </section>

          {/* finance-balance-card */}
          <Link
            href="/finances"
            className="finance-balance-card box-border flex flex-col items-start p-5 gap-3 w-full bg-[#FFFFFF] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] flex-none order-2 self-stretch flex-grow-0 transition-transform active:scale-[0.99] cursor-pointer"
          >
            <div className="card-top flex flex-row justify-between items-center p-0 w-full h-[47px]">
              <div className="label-container flex flex-col items-start p-0 gap-0.5">
                <span className="font-outfit font-semibold text-[13px] leading-[16px] text-[#8D6E63] dark:text-[#948D87] tracking-wide">
                  {t.dashboard.financeTitle}
                </span>
                <h3 className="font-outfit font-bold text-[18px] leading-[23px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.dashboard.currentBalance}
                </h3>
              </div>

              <div className="icon-circle flex flex-row justify-center items-center w-[40px] h-[40px] bg-[#BBDEFB] dark:bg-[#1565C0]/30 rounded-[20px]">
                <Wallet className="w-5 h-5 stroke-[#1565C0] dark:stroke-[#90CAF9]" strokeWidth={2.2} />
              </div>
            </div>

            <div className="balance-amount flex flex-row items-center p-0 gap-2 w-full h-[40px]">
              <span className="font-outfit font-bold text-[28px] leading-[36px] text-[#5D4037] dark:text-[#DDD7D2]">
                ฿{financeBalance.toFixed(2)}
              </span>

              <div className="status-pill flex flex-row items-center px-2.5 py-1 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[12px]">
                <span className="font-dm-sans font-medium text-[11px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {financeBalance > 0 ? t.finances.pendingPay : t.dashboard.allSettled}
                </span>
              </div>
            </div>
          </Link>

        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL: MYSTERY BOX SPIN MODAL                            */}
      {/* ======================================================== */}
      {isGachaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-[370px] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border-2 border-[#F2C94C] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-center relative overflow-hidden">
            <button
              onClick={() => setIsGachaModalOpen(false)}
              className="absolute top-3.5 right-3.5 p-1 rounded-full text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {spinResult ? (
              /* REVEAL RESULT */
              <div className="py-2 space-y-3">
                <div className="w-16 h-16 rounded-[22px] bg-gradient-to-tr from-[#E65100] to-[#F2C94C] text-white flex items-center justify-center mx-auto shadow-md animate-bounce">
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

                <div className="p-4 rounded-[18px] bg-[#FFF8E7] dark:bg-[#2A231A] border border-[#F2C94C]/60 text-center">
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
                <div className={`w-16 h-16 rounded-[22px] bg-gradient-to-tr from-[#E65100] to-[#F2C94C] text-white flex items-center justify-center mx-auto shadow-md ${isSpinning ? 'animate-spin' : 'animate-bounce'}`}>
                  <Gift className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-[18px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2]">
                    กล่องสุ่มงานบ้าน x คะแนนคูณ
                  </h3>
                  <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-1">
                    สุ่มเลือกงานบ้านที่จะได้รับโบนัสคูณคะแนนประจำสัปดาห์นี้
                  </p>
                </div>

                <div className="p-3 bg-[#FFF8E7] dark:bg-[#282421] rounded-[16px] text-[12px] text-[#8D6E63] dark:text-[#948D87] space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <span>ใช้คะแนนสุ่ม:</span>
                    <span className="font-bold text-[#E65100]">10 คะแนน</span>
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
                  disabled={isSpinning || myChorePoints < 10}
                  onClick={handleSpinGacha}
                  className="w-full py-2.5 rounded-[14px] bg-gradient-to-r from-[#E65100] to-[#F2C94C] text-white text-[13px] font-extrabold shadow-md hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSpinning ? (
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-[390px] max-h-[80vh] bg-[#FDFBF7] dark:bg-[#201D1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] p-5 shadow-2xl flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#5D4037] dark:text-[#DDD7D2]" />
                <h3 className="text-[17px] font-extrabold text-[#5D4037] dark:text-[#DDD7D2]">
                  ประวัติการสุ่มกล่องปริศนา
                </h3>
              </div>
              <button
                onClick={() => setIsGachaHistoryModalOpen(false)}
                className="p-1 rounded-full text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto no-scrollbar space-y-2.5 flex-1 pr-1">
              {gachaHistory.length === 0 ? (
                <div className="py-10 text-center text-[#8D6E63]">
                  <p className="text-[13px]">ยังไม่มีประวัติการสุ่มกล่องปริศนา</p>
                </div>
              ) : (
                gachaHistory.map((spin) => {
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
  );
}
