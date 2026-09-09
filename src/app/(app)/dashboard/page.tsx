'use client';

import { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Wallet, 
  ShoppingCart, 
  PawPrint, 
  Check,
  CheckSquare,
  Gift,
  Coins,
  ChevronRight,
  HelpCircle,
  Trophy,
  Zap
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
  type DbProfile,
  type DbPet
} from '@/lib/services/db';
import { parseChoreSchedule } from '@/app/(app)/chores/page';

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

  // Dynamic household members & real data
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [pets, setPets] = useState<DbPet[]>([]);
  const [realShoppingCount, setRealShoppingCount] = useState<number | null>(null);
  const [activeUserAvatar, setActiveUserAvatar] = useState<string | null>(profile.myAvatarUrl || null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [myChorePoints, setMyChorePoints] = useState<number>(0);
  const [togglingChoreId, setTogglingChoreId] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(0);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

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

            if (p.household_id) {
              setHouseholdId(p.household_id);
              const h = await fetchHousehold(p.household_id);
              if (h) {
                updateProfile({
                  name: h.name,
                  inviteCode: h.invite_code,
                });
              }
              const [mems, chs, dbPets, dbLists] = await Promise.all([
                fetchHouseholdMembers(p.household_id),
                fetchChores(p.household_id),
                fetchPets(p.household_id),
                fetchShoppingLists(p.household_id),
              ]);
              setMembers(mems);
              setPets(dbPets);
              const unpurchasedCount = dbLists.reduce(
                (sum, l) => sum + (l.items?.filter((i) => !i.is_purchased).length || 0),
                0
              );
              setRealShoppingCount(unpurchasedCount);

              const nowTime = new Date();
              const todayStr = nowTime.toLocaleDateString('en-CA');
              const todayMidnight = new Date(
                nowTime.getFullYear(),
                nowTime.getMonth(),
                nowTime.getDate()
              ).getTime();

              setStoreChores(
                chs.map((c) => {
                  let isDone = c.is_completed;
                  if (isDone && c.completed_at) {
                    const schedule = parseChoreSchedule(c);
                    const compDate = new Date(c.completed_at);
                    const compDayStr = compDate.toLocaleDateString('en-CA');
                    const compMidnight = new Date(
                      compDate.getFullYear(),
                      compDate.getMonth(),
                      compDate.getDate()
                    ).getTime();
                    const elapsedDays = Math.floor(
                      (todayMidnight - compMidnight) / (1000 * 60 * 60 * 24)
                    );

                    if (schedule.isDaily && compDayStr < todayStr) {
                      isDone = false;
                    } else if (!schedule.isDaily && elapsedDays >= schedule.intervalDays) {
                      isDone = false;
                    }
                  }

                  return {
                    id: c.id,
                    title: c.title,
                    frequency: (c.frequency as any) || 'daily',
                    assignedTo: c.assigned_to || 'All',
                    points: c.points || 10,
                    isCompleted: isDone,
                    dueDate: c.due_date || undefined,
                  };
                })
              );
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
      return { completed: 0, total: 0, remaining: 0, percent: 0, remainingPercent: 0 };
    }
    const completed = chores.filter((c) => c.isCompleted).length;
    const remaining = total - completed;
    const percent = Math.round((completed / total) * 100);
    const remainingPercent = Math.max(0, 100 - percent);
    return { completed, total, remaining, percent, remainingPercent };
  }, [chores]);

  const allChoresDone = chores.length === 0 || choreStats.remaining === 0;

  // Circular progress math
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = allChoresDone
    ? 0
    : circumference - (choreStats.remainingPercent / 100) * circumference;

  // Real unpurchased shopping items count
  const shoppingCount = useMemo(() => {
    if (realShoppingCount !== null) return realShoppingCount;
    return shoppingItems.filter((i) => !i.isPurchased).length;
  }, [realShoppingCount, shoppingItems]);

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
            <div className="welcome-text flex flex-col items-start p-0 gap-0.5 flex-1 min-w-0 pr-2">
              <span className="font-dm-sans font-medium text-[12.5px] leading-[17px] text-[#8D6E63] dark:text-[#948D87] tracking-wide truncate w-full">
                {formatCurrentDate()}
              </span>
              <h1 className="font-outfit font-extrabold text-[22px] sm:text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2] truncate w-full">
                {greeting}, {profile.myNickname || profile.name}!
              </h1>
            </div>

            {/* Top Right Header Action: Notification Bell & Dual Avatars */}
            <div className="flex items-center gap-2.5">
              <NotificationBell />

              <Link
                href="/profile"
                className="group flex items-center transition-transform active:scale-95 cursor-pointer"
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
          {/* 1. CHORES SECTION WITH CIRCULAR PROGRESS RING            */}
          {/* ======================================================== */}
          <section className="chores-card box-border flex flex-col items-start p-4 gap-3 w-full bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px]">
            {/* Card Top: Text & Circular Ring */}
            <div className="card-top flex flex-row justify-between items-center p-0 w-full">
              <div className="label-container flex flex-col items-start p-0 gap-1 flex-1 min-w-0 pr-2">
                <span className="font-outfit font-semibold text-[13px] leading-[16px] text-[#8D6E63] dark:text-[#948D87] tracking-wide">
                  {t.dashboard.todayChores}
                </span>

                <h3 className="font-outfit font-bold text-[17px] leading-[22px] text-[#5D4037] dark:text-[#DDD7D2] truncate w-full">
                  {allChoresDone || chores.length === 0
                    ? 'งานบ้านหมดแล้ว'
                    : `เหลืองานบ้านอีก ${choreStats.remainingPercent}% ของวันนี้`}
                </h3>

                <div className="flex items-center gap-2 mt-0.5">
                  {chores.length > 0 ? (
                    <div className="badge-completed flex flex-row items-center px-2 py-0.5 bg-[#C8E6C9] dark:bg-[#1B5E20]/40 rounded-[10px]">
                      <span className="font-dm-sans font-bold text-[11px] text-[#2E7D32] dark:text-[#81C784]">
                        {choreStats.completed} / {choreStats.total} {allChoresDone ? 'เสร็จครบแล้ว' : t.dashboard.choresDone}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                      งานบ้านหมดแล้ว
                    </span>
                  )}

                  <Link
                    href="/chores"
                    className="text-[11px] font-bold text-[#2E7D32] dark:text-[#81C784] hover:underline flex items-center gap-0.5"
                  >
                    <span>จัดการ</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Old-style Circular Progress Ring */}
              <div className="progress-ring-container flex flex-col justify-center items-center p-0 isolate relative w-[76px] h-[76px] flex-none order-1 shrink-0">
                <svg className="w-[76px] h-[76px] -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="#FFFFFF"
                    stroke="#FFFFFF"
                    className="dark:fill-[#141312] dark:stroke-[#141312]"
                    strokeWidth="7"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="#E8DFD8"
                    className="dark:stroke-[#2E2A27]"
                    strokeWidth="6"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke={allChoresDone ? '#2E7D32' : '#2E7D32'}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                <div className="center-label flex flex-col items-center p-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  {allChoresDone ? (
                    <Check className="w-5 h-5 text-[#2E7D32] stroke-[3]" />
                  ) : (
                    <span className="font-outfit font-bold text-[15px] leading-[18px] text-[#5D4037] dark:text-[#DDD7D2]">
                      {choreStats.remainingPercent}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Chore Checklist: กล่องยาวแต่ไม่สูง (Horizontal items, no % inside) */}
            {allChoresDone ? (
              <div className="w-full pt-2 border-t border-[#D7CCC8]/60 dark:border-[#2E2A27]">
                <div className="text-center py-2 px-3 rounded-[14px] bg-[#E8F5E9]/60 dark:bg-[#1B5E20]/20 border border-[#2E7D32]/20 font-dm-sans">
                  <span className="font-dm-sans text-[12px] font-bold text-[#2E7D32] dark:text-[#81C784] flex items-center justify-center gap-1.5">
                    🎉 งานบ้านหมดแล้ว
                  </span>
                  <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] mt-0.5">
                    ทำงานบ้านครบหมดแล้ว พักผ่อนได้เลย~
                  </p>
                </div>
              </div>
            ) : chores.length === 0 ? (
              <div className="w-full pt-2 border-t border-[#D7CCC8]/60 dark:border-[#2E2A27] text-center py-1">
                <span className="font-dm-sans text-[12px] font-bold text-[#2E7D32] dark:text-[#81C784]">
                  งานบ้านหมดแล้ว
                </span>
              </div>
            ) : (
              <div className="w-full pt-2 border-t border-[#D7CCC8]/60 dark:border-[#2E2A27] space-y-1.5 font-dm-sans">
                {chores.slice(0, 3).map((chore) => {
                  return (
                    <div
                      key={chore.id}
                      onClick={() => handleQuickToggleChore(chore.id, chore.isCompleted)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-[12px] bg-white/70 dark:bg-[#141312]/60 hover:bg-white dark:hover:bg-[#141312] border border-[#D7CCC8]/50 dark:border-[#2E2A27]/60 transition-colors cursor-pointer font-dm-sans"
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
                          className={`font-dm-sans text-[12px] font-semibold truncate ${
                            chore.isCompleted
                              ? 'line-through text-[#8D6E63]/60 dark:text-[#948D87]/60'
                              : 'text-[#5D4037] dark:text-[#DDD7D2]'
                          }`}
                        >
                          {chore.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="font-outfit text-[11px] font-bold text-[#2E7D32] dark:text-[#81C784]">
                          +{chore.points} pt
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
          <section className="w-full p-3.5 rounded-[22px] bg-gradient-to-r from-[#F4EFEA] to-[#ECE5DC] dark:from-[#24211E] dark:to-[#1C1A18] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-xs flex items-center justify-between gap-3 font-dm-sans">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-[14px] bg-[#5D4037] dark:bg-[#3D2C22] border border-[#5D4037]/20 dark:border-[#FFD54F]/30 text-[#FFD54F] flex items-center justify-center shrink-0 shadow-xs">
                <Gift className="w-5 h-5 text-[#FFD54F]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-outfit font-bold text-[15px] text-[#5D4037] dark:text-[#DDD7D2] leading-snug">
                  {language === 'th' ? 'ร้านค้าแลกรางวัล' : 'Reward Shop'}
                </h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <Coins className="w-3.5 h-3.5 text-[#E65100] shrink-0" />
                  <span className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                    {language === 'th' ? 'คะแนนของคุณ:' : 'Your Points:'}
                  </span>
                  <span className="font-outfit font-bold text-[13px] text-[#E65100] dark:text-[#FFB74D]">
                    {myChorePoints} {language === 'th' ? 'คะแนน' : 'pts'}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/rewards"
              className="shrink-0 px-3 py-1.5 rounded-[12px] bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] font-dm-sans text-[12px] font-bold hover:opacity-90 shadow-2xs flex items-center gap-1"
            >
              <span>{language === 'th' ? 'ไปร้านค้า' : 'Shop'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </section>



          {/* ======================================================== */}
          {/* 3. PETS SHOWCASE SECTION (ขึ้นรูปน้องด้วย)                  */}
          {/* ======================================================== */}
          <section className="pets-section w-full flex flex-col gap-2.5">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[10px] bg-[#FFF3E0] dark:bg-[#3E2512]/60 border border-[#FFE0B2] dark:border-[#E65100]/40 flex items-center justify-center text-[#E65100] dark:text-[#FFB74D]">
                  <PawPrint className="w-4 h-4 stroke-current" strokeWidth={2.2} />
                </div>
                <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'สัตว์เลี้ยงของเรา' : 'Our Pets'}
                </h3>
                {pets.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F4EFEA] dark:bg-[#25201D] text-[#8D6E63] dark:text-[#948D87] border border-[#D7CCC8]/60 dark:border-[#2E2A27]">
                    {pets.length}
                  </span>
                )}
              </div>

              <Link
                href="/pets"
                className="text-[12px] font-bold text-[#E65100] dark:text-[#FFB74D] hover:underline flex items-center gap-0.5"
              >
                <span>{language === 'th' ? 'ดูบันทึก & ดูแลน้อง' : 'View all'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {pets.length === 0 ? (
              <Link
                href="/pets"
                className="box-border flex items-center gap-3.5 p-4 w-full bg-[#F4EFEA]/70 dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[22px] hover:opacity-90 transition-transform active:scale-[0.99] cursor-pointer"
              >
                <div className="w-13 h-13 rounded-[16px] bg-[#FFF3E0] dark:bg-[#3E2512]/60 border border-[#FFE0B2] dark:border-[#E65100]/40 flex items-center justify-center text-[#E65100] dark:text-[#FFB74D] shrink-0">
                  <PawPrint className="w-6 h-6 stroke-current" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-outfit font-bold text-[14px] text-[#5D4037] dark:text-[#DDD7D2]">
                    {language === 'th' ? 'ยังไม่มีสัตว์เลี้ยงในบ้าน' : 'No pets added yet'}
                  </div>
                  <div className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-0.5">
                    {language === 'th' ? 'แตะที่นี่เพื่อเพิ่มน้องและใส่รูปน่ารักๆ' : 'Tap to add your companion with photo'}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#5D4037] dark:bg-[#DDD7D2] text-white dark:text-[#1A1816] flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 stroke-current" strokeWidth={2.5} />
                </div>
              </Link>
            ) : (
              <div className="space-y-2.5">
                {pets.map((pet) => (
                  <Link
                    key={pet.id}
                    href="/pets"
                    className="box-border flex items-center gap-3.5 p-3.5 w-full bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] hover:shadow-[0px_6px_20px_rgba(93,64,55,0.06)] transition-all active:scale-[0.99] cursor-pointer"
                  >
                    {/* Pet Photo Container */}
                    <div className="relative w-[68px] h-[68px] sm:w-[74px] sm:h-[74px] rounded-[18px] overflow-hidden bg-[#FFF3E0] dark:bg-[#3E2512]/60 border border-[#FFE0B2] dark:border-[#E65100]/30 shrink-0 shadow-2xs">
                      {pet.photo_url ? (
                        <img
                          src={pet.photo_url}
                          alt={pet.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#E65100] dark:text-[#FFB74D]">
                          <PawPrint className="w-6 h-6 stroke-current" strokeWidth={2.2} />
                          <span className="text-[9px] font-bold mt-0.5">
                            {language === 'th' ? 'รูปน้อง' : 'Photo'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pet Information */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-outfit font-extrabold text-[16px] leading-tight text-[#5D4037] dark:text-[#DDD7D2] truncate">
                          {pet.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            pet.gender === 'male'
                              ? 'bg-[#E3F2FD] text-[#1976D2] dark:bg-[#0D47A1]/40 dark:text-[#90CAF9]'
                              : 'bg-[#FCE4EC] text-[#C2185B] dark:bg-[#880E4F]/40 dark:text-[#F48FB1]'
                          }`}
                        >
                          {pet.gender === 'male' ? '♂ ผู้' : '♀ เมีย'}
                        </span>
                      </div>

                      <div className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-0.5 truncate">
                        {pet.breed || (language === 'th' ? 'เพื่อนร่วมบ้านแสนรัก' : 'Companion')}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8]/40 dark:border-[#2E2A27]/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]" />
                          {language === 'th' ? 'วัคซีน & กรูมมิ่ง' : 'Care Logs'}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-[#8D6E63] dark:text-[#948D87] shrink-0 opacity-60" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* 4. SHOPPING LIST SUMMARY                                 */}
          {/* ======================================================== */}
          <Link
            href="/shopping"
            className="box-border flex flex-row items-center justify-between p-4 w-full bg-[#FFFFFF] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] transition-transform active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-[16px] bg-[#E8F5E9] dark:bg-[#1B3E22]/60 border border-[#C8E6C9] dark:border-[#2E7D32]/40 flex items-center justify-center text-[#2E7D32] dark:text-[#81C784] shrink-0">
                <ShoppingCart className="w-5 h-5 stroke-current" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                  {shoppingCount} {t.common.items} {language === 'th' ? 'ในลิสต์ซื้อของ' : 'in shopping list'}
                </div>
                <div className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87] truncate mt-0.5">
                  {shoppingCount > 0 ? t.dashboard.inSharedList : t.dashboard.noShoppingItems}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8D6E63] dark:text-[#948D87] shrink-0 opacity-60" />
          </Link>

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

              <div className="icon-circle flex flex-row justify-center items-center w-[40px] h-[40px] bg-[#E3F2FD] dark:bg-[#102A45]/60 border border-[#BBDEFB] dark:border-[#1565C0]/40 rounded-[20px]">
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



    </div>
  );
}
