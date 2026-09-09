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
  UserPlus
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
  type DbProfile 
} from '@/lib/services/db';

export default function DashboardPage() {
  const { t, formatCurrentDate, language } = useLanguage();

  // Real store data
  const chores = useAppStore((state) => state.chores);
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
            }
          }
        }
      } catch (err) {
        console.warn('Dashboard sync notice:', err);
      }
    }

    syncDashboard();
  }, [updateProfile]);

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

  // Circular progress math
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (choreStats.percent / 100) * circumference;

  return (
    <div className="home-dashboard flex flex-col justify-between items-start p-0 relative w-full max-w-md sm:max-w-[448px] min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] mx-auto select-none transition-colors duration-200">
      {/* scrollable-content */}
      <div className="scrollable-content flex flex-col items-start p-0 w-full flex-none order-0 self-stretch flex-grow-0">
        
        {/* Top utility row with household name and notification bell */}
        <div className="flex flex-row justify-between items-center px-6 pt-4 pb-1 w-full flex-none order-0 self-stretch flex-grow-0">
          <div className="flex items-center gap-1.5">
            <RiBearSmileFill className="w-4 h-4 fill-[#5D4037] dark:fill-[#DDD7D2]" />
            <span className="font-dm-sans font-medium text-[12px] text-[#8D6E63] dark:text-[#948D87]">
              {profile.name || 'Bobbies Homie'}
            </span>
          </div>

          <NotificationBell />
        </div>

        {/* dashboard-header */}
        <header className="dashboard-header flex flex-col items-start px-6 pt-2 pb-4 gap-4 w-full flex-none order-1 self-stretch flex-grow-0">
          <div className="header-row flex flex-row justify-between items-center p-0 w-full flex-none order-0 self-stretch flex-grow-0">
            {/* greeting-info */}
            <div className="greeting-info flex flex-col items-start p-0 gap-1 flex-none order-0 flex-grow-0">
              <h1 className="font-outfit font-bold text-[26px] leading-[32px] text-[#5D4037] dark:text-[#DDD7D2] flex-none order-0 flex-grow-0">
                {greeting}, {profile.myNickname || (language === 'th' ? 'เพื่อนร่วมบ้าน' : 'Homie')}
              </h1>
              <p className="font-dm-sans font-normal text-[14px] leading-[18px] text-[#8D6E63] dark:text-[#948D87] flex-none order-1 flex-grow-0">
                {formatCurrentDate()}
              </p>
            </div>

            {/* Account Page Trigger (Dual Household Avatars) */}
            <Link 
              href="/profile"
              title={
                partnerMember
                  ? `${currentMember?.nickname || currentMember?.full_name || 'Me'} & ${partnerMember.nickname || partnerMember.full_name || 'Partner'}`
                  : (language === 'th' ? 'บัญชีและการตั้งค่า' : 'Account & Settings')
              }
              className="flex flex-row items-center p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95 cursor-pointer"
            >
              {/* Member 1 (Current User) */}
              <div 
                title={currentMember?.nickname || currentMember?.full_name || 'Me'}
                className="relative w-[38px] h-[38px] rounded-full bg-[#D7CCC8] dark:bg-[#5D4037] border-2 border-[#FDFBF7] dark:border-[#1A1816] shadow-sm z-10 overflow-hidden flex items-center justify-center shrink-0 text-[#5D4037] dark:text-[#DDD7D2]"
              >
                {currentMember?.avatar_url ? (
                  <img 
                    src={currentMember.avatar_url} 
                    alt={currentMember.nickname || 'Avatar'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="font-outfit font-bold text-[13px]">
                    {(currentMember?.nickname || currentMember?.full_name || 'M').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Member 2 (Partner in Household) */}
              {partnerMember ? (
                <div 
                  title={partnerMember.nickname || partnerMember.full_name || 'Partner'}
                  className="relative w-[38px] h-[38px] -ml-[12px] rounded-full bg-[#E8DFD8] dark:bg-[#3E322A] border-2 border-[#FDFBF7] dark:border-[#1A1816] shadow-sm z-20 overflow-hidden flex items-center justify-center shrink-0 text-[#8D6E63] dark:text-[#DDD7D2]"
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
        <main className="dashboard-body flex flex-col items-start px-6 p-0 gap-5 w-full flex-none order-2 self-stretch flex-grow-0">
          
          {/* chore-progress-card */}
          <section className="chore-progress-card box-border flex flex-col items-start p-5 gap-3 w-full bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] flex-none order-0 self-stretch flex-grow-0 transition-colors">
            <div className="card-split flex flex-row items-center p-0 gap-4 w-full min-h-[95px] flex-none order-0 self-stretch flex-grow-0">
              {/* progress-left */}
              <div className="progress-left flex flex-col items-start p-0 gap-1.5 flex-1 min-h-[95px] flex-none order-0 flex-grow-1">
                <h2 className="font-outfit font-bold text-[18px] leading-[23px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {t.dashboard.todayChores}
                </h2>
                <p className="font-dm-sans font-normal text-[13px] leading-[17px] text-[#8D6E63] dark:text-[#948D87]">
                  {choreStats.total > 0
                    ? t.dashboard.choresSubtitle
                    : t.dashboard.noChoresToday}
                </p>

                {choreStats.total > 0 ? (
                  <div className="badge-completed flex flex-row items-center px-2.5 py-1 h-[24px] bg-[#C8E6C9] dark:bg-[#1B5E20]/40 rounded-[12px] mt-1">
                    <span className="font-dm-sans font-bold text-[12px] leading-[16px] text-[#2E7D32] dark:text-[#81C784]">
                      {choreStats.completed} / {choreStats.total} {t.dashboard.choresDone}
                    </span>
                  </div>
                ) : (
                  <Link
                    href="/create?tab=chores"
                    className="inline-flex items-center text-[12px] font-semibold text-[#2E7D32] dark:text-[#81C784] hover:underline mt-1"
                  >
                    + {t.dashboard.addChorePrompt}
                  </Link>
                )}
              </div>

              {/* progress-ring-container */}
              <div className="progress-ring-container flex flex-col justify-center items-center p-0 isolate relative w-[80px] h-[80px] flex-none order-1 flex-grow-0 shrink-0">
                <svg className="w-[80px] h-[80px] -rotate-90" viewBox="0 0 80 80">
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
                    stroke="#2E7D32"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                <div className="center-label flex flex-col items-center p-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <span className="font-outfit font-bold text-[16px] leading-[20px] text-[#5D4037] dark:text-[#DDD7D2]">
                    {choreStats.percent}%
                  </span>
                </div>
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
    </div>
  );
}
