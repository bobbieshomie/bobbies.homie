'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  Users, 
  Star, 
  Copy, 
  Check, 
  Pencil, 
  X, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Award, 
  Sparkles, 
  User, 
  ChevronRight,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { useLanguage } from '@/lib/i18n/language-context';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { 
  fetchProfile, 
  fetchHousehold, 
  fetchHouseholdMembers, 
  joinHouseholdByCode, 
  type DbProfile, 
  type DbHousehold 
} from '@/lib/services/db';

export default function HouseholdSettingsPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const profile = useAppStore((state) => state.profile);
  const setStoreProfile = useAppStore((state) => state.updateProfile);

  // States
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [household, setHousehold] = useState<DbHousehold | null>(null);
  const [householdName, setHouseholdName] = useState(profile.name || 'Bobbies Homie');
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [loading, setLoading] = useState(true);

  // Household name edit & invite code visibility
  const [isEditingHouseholdName, setIsEditingHouseholdName] = useState(false);
  const [tempHouseholdName, setTempHouseholdName] = useState('');
  const [savingHouseholdName, setSavingHouseholdName] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);

  // Status feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Load active user, household & members data
  useEffect(() => {
    async function loadHouseholdData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          const dbProf = await fetchProfile(user.id);
          if (dbProf?.household_id) {
            const h = await fetchHousehold(dbProf.household_id);
            if (h) {
              setHousehold(h);
              setHouseholdName(h.name);
            }
            const mems = await fetchHouseholdMembers(dbProf.household_id);
            // Sort members by chore_points descending (top helper first)
            const sortedMems = [...mems].sort((a, b) => (b.chore_points ?? 0) - (a.chore_points ?? 0));
            setMembers(sortedMems);
          }
        }
      } catch (err) {
        console.warn('Load household data notice:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHouseholdData();
  }, []);

  // Copy household invite code
  const handleCopyCode = () => {
    const codeToCopy = household?.invite_code || profile.inviteCode || '';
    if (!codeToCopy) return;
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Household name editing handlers
  const startEditingHouseholdName = () => {
    setTempHouseholdName(householdName);
    setIsEditingHouseholdName(true);
  };

  const cancelEditingHouseholdName = () => {
    setIsEditingHouseholdName(false);
  };

  const handleSaveHouseholdName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tempHouseholdName.trim();
    if (!trimmed || trimmed === householdName) {
      setIsEditingHouseholdName(false);
      return;
    }

    try {
      setSavingHouseholdName(true);
      if (household?.id) {
        const supabase = createClient();
        const { error } = await supabase
          .from('households')
          .update({ name: trimmed })
          .eq('id', household.id);
        if (error) throw error;
      }
      setHouseholdName(trimmed);
      if (household) {
        setHousehold({ ...household, name: trimmed });
      }
      setStoreProfile({ name: trimmed });
      setIsEditingHouseholdName(false);
      setStatusMessage({
        type: 'success',
        text: language === 'th' ? 'เปลี่ยนชื่อบ้านสำเร็จเรียบร้อยแล้ว' : 'Household name updated successfully',
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update household name';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSavingHouseholdName(false);
    }
  };

  // Join another household with invite code
  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsJoining(true);
    setStatusMessage(null);

    try {
      const userId = currentUser?.id;
      if (!userId) {
        throw new Error(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนเข้าร่วมบ้าน' : 'Please sign in to join a household');
      }

      const joinedH = await joinHouseholdByCode(joinCodeInput.trim(), userId);
      setHousehold(joinedH);
      setHouseholdName(joinedH.name);
      
      const newMems = await fetchHouseholdMembers(joinedH.id);
      const sortedMems = [...newMems].sort((a, b) => (b.chore_points ?? 0) - (a.chore_points ?? 0));
      setMembers(sortedMems);

      setJoinCodeInput('');
      setStatusMessage({ 
        type: 'success', 
        text: language === 'th' ? `เข้าร่วมบ้าน "${joinedH.name}" เรียบร้อยแล้ว` : `Joined "${joinedH.name}" successfully` 
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Invalid invite code';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsJoining(false);
    }
  };

  // Calculate total household points
  const totalHouseholdPoints = members.reduce((sum, m) => sum + (m.chore_points || 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Header */}
      <div className="px-6 pt-5 pb-2 w-full">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[13px] font-dm-sans font-bold text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] dark:hover:text-[#FDFBF7] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'th' ? 'ย้อนกลับ' : 'Back'}</span>
          </button>

          <Link
            href="/profile"
            className="text-[12px] font-dm-sans font-bold text-[#5D4037] dark:text-[#D7CCC8] hover:underline flex items-center gap-1"
          >
            <User className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'ข้อมูลส่วนตัว' : 'My Profile'}</span>
          </Link>
        </div>

        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2]">
            {language === 'th' ? 'ตั้งค่าบ้าน & สมาชิก' : 'Household & Members'}
          </h1>
          <p className="font-dm-sans text-[12px] leading-normal text-[#8D6E63] dark:text-[#948D87] mt-1">
            {language === 'th' ? 'จัดการข้อมูลบ้าน รหัสคำเชิญ และดูคะแนนคนในบ้าน' : 'Manage household details, invite codes & member points'}
          </p>
        </div>

        {/* Tab Switcher: Profile vs Household */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-[#F4EFEA] dark:bg-[#201D1A] rounded-[16px] border border-[#D7CCC8]/60 dark:border-[#2E2A27]">
          <Link
            href="/profile"
            className="py-2 px-3 rounded-[12px] font-outfit text-[12.5px] font-bold text-center text-[#8D6E63] dark:text-[#948D87] hover:bg-white/60 dark:hover:bg-[#2E2A27]/60 transition-all"
          >
            {language === 'th' ? '👤 บัญชีส่วนตัว' : '👤 Profile'}
          </Link>
          <div className="py-2 px-3 rounded-[12px] font-outfit text-[12.5px] font-bold text-center bg-white dark:bg-[#2E2A27] text-[#5D4037] dark:text-[#FDFBF7] shadow-xs">
            {language === 'th' ? '🏠 บ้านและสมาชิก' : '🏠 Household'}
          </div>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="mx-6 my-2">
          <div className={`p-3 rounded-[14px] text-[13px] font-medium border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}>
            {statusMessage.text}
          </div>
        </div>
      )}

      <div className="flex-1 px-6 space-y-4 pt-2">
        {/* ======================================================== */}
        {/* 1. HOUSEHOLD OVERVIEW CARD                               */}
        {/* ======================================================== */}
        <section className="bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] p-5 shadow-xs transition-colors space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-[#5D4037] text-[#FFD54F] flex items-center justify-center shadow-xs">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'ข้อมูลบ้านของเรา' : 'Household Details'}
                </h3>
              </div>
            </div>

            <span className="text-[11px] font-dm-sans font-bold px-2.5 py-0.5 rounded-full bg-white dark:bg-[#141312] text-[#8D6E63] dark:text-[#948D87] border border-[#D7CCC8]/60 dark:border-[#2E2A27]">
              {members.length} {language === 'th' ? 'สมาชิก' : 'Members'}
            </span>
          </div>

          {/* Household Name with Inline Edit */}
          <div className="p-3.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[18px]">
            {isEditingHouseholdName ? (
              <form onSubmit={handleSaveHouseholdName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87]">
                    {language === 'th' ? 'ระบุชื่อบ้านใหม่' : 'New Household Name'}
                  </label>
                  <span className="text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                    {language === 'th' ? 'กดบันทึกเพื่อเปลี่ยน' : 'Save to apply'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    required
                    value={tempHouseholdName}
                    onChange={(e) => setTempHouseholdName(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#5D4037] dark:border-[#D7CCC8] rounded-[14px] text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none"
                    placeholder={language === 'th' ? 'ชื่อบ้าน...' : 'Household name...'}
                  />
                  <button
                    type="submit"
                    disabled={savingHouseholdName}
                    className="px-3.5 py-2 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[14px] text-[12px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingHouseholdName ? '...' : (language === 'th' ? 'บันทึก' : 'Save')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingHouseholdName}
                    disabled={savingHouseholdName}
                    className="p-2 bg-[#F4EFEA] dark:bg-[#1F1D1B] hover:bg-[#D7CCC8]/40 dark:hover:bg-[#2E2A27] text-[#8D6E63] dark:text-[#948D87] rounded-[14px] border border-[#D7CCC8] dark:border-[#2E2A27] transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
                    title={language === 'th' ? 'ยกเลิก' : 'Cancel'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <span className="text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] block mb-1">
                  {language === 'th' ? 'ชื่อบ้านของคุณ' : 'Household Name'}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                    {householdName || household?.name || (language === 'th' ? 'บ้านของเรา' : 'Our Home')}
                  </span>
                  <button
                    type="button"
                    onClick={startEditingHouseholdName}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EFEA] dark:bg-[#1F1D1B] hover:bg-[#D7CCC8] dark:hover:bg-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] rounded-[12px] text-[12px] font-semibold border border-[#D7CCC8] dark:border-[#2E2A27] transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
                    title={language === 'th' ? 'กดเพื่อเปลี่ยนชื่อบ้าน' : 'Click to change name'}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'เปลี่ยนชื่อ' : 'Edit'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Invite Code Box with Show/Hide & Copy */}
          <div className="p-3.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[18px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87]">
                {language === 'th' ? 'รหัสคำเชิญสำหรับสมาชิก' : 'Invite Code for Members'}
              </span>
              <button
                type="button"
                onClick={() => setShowInviteCode((prev) => !prev)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[8px] bg-[#F4EFEA] dark:bg-[#1F1D1B] hover:bg-[#D7CCC8]/50 dark:hover:bg-[#2E2A27] text-[11px] font-semibold text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] dark:hover:text-[#FDFBF7] transition-colors cursor-pointer"
              >
                {showInviteCode ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'ซ่อนรหัส' : 'Hide'}</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'แสดงรหัส' : 'Show'}</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              {showInviteCode ? (
                <code className="font-dm-sans font-bold text-[18px] tracking-widest text-[#5D4037] dark:text-[#DDD7D2] select-all">
                  {household?.invite_code || '...'}
                </code>
              ) : (
                <span className="font-mono text-[18px] tracking-[0.25em] text-[#8D6E63] dark:text-[#948D87] select-none font-bold">
                  ••••••••
                </span>
              )}
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EFEA] dark:bg-[#1F1D1B] hover:bg-[#D7CCC8] dark:hover:bg-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] rounded-[12px] text-[12px] font-semibold border border-[#D7CCC8] dark:border-[#2E2A27] transition-all cursor-pointer shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{language === 'th' ? 'คัดลอกแล้ว' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'คัดลอกรหัส' : 'Copy Code'}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] font-dm-sans text-[#8D6E63] dark:text-[#948D87] mt-2">
              {language === 'th' 
                ? 'ส่งรหัส 8 หลักนี้ให้แฟนหรือเพื่อนร่วมบ้านเพื่อเข้าร่วมบ้านนี้ได้ทันที' 
                : 'Share this 8-character code with your partner or housemate to join.'}
            </p>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 2. HOUSEHOLD MEMBERS & POINTS CARD                       */}
        {/* ======================================================== */}
        <section className="bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] p-5 shadow-xs transition-colors space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-[#E0533C] text-white flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'สมาชิกในบ้าน & คะแนนสะสม' : 'Members & Points'}
                </h3>
              </div>
            </div>

            {/* Total Household Points Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFF8E1] dark:bg-[#2A2318] border border-[#FFE082] dark:border-[#534323] rounded-full">
              <Star className="w-3.5 h-3.5 text-[#FFB300] fill-[#FFB300]" />
              <span className="font-outfit font-extrabold text-[12px] text-[#E65100]">
                {totalHouseholdPoints} {language === 'th' ? 'คะแนนรวม' : 'pts total'}
              </span>
            </div>
          </div>

          <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
            {language === 'th'
              ? 'คะแนนสะสมที่แต่ละคนได้รับจากการทำงานบ้านและกิจกรรมในบ้าน'
              : 'Chore points earned by each household member from completing daily chores.'}
          </p>

          {/* Members List */}
          <div className="space-y-2.5">
            {members.length > 0 ? (
              members.map((m, index) => {
                const isMe = m.id === currentUser?.id;
                const points = m.chore_points ?? 0;
                const isTopHelper = index === 0 && points > 0;

                return (
                  <div 
                    key={m.id}
                    className={`p-3.5 rounded-[18px] border transition-all ${
                      isMe
                        ? 'bg-white dark:bg-[#141312] border-[#5D4037]/50 dark:border-[#D7CCC8]/40 shadow-xs ring-1 ring-[#5D4037]/10'
                        : 'bg-white/80 dark:bg-[#141312]/80 border-[#D7CCC8] dark:border-[#2E2A27]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-[#D7CCC8] dark:bg-[#2E2A27] border-2 border-white dark:border-[#2E2A27] flex items-center justify-center text-[15px] font-bold text-[#5D4037] dark:text-[#DDD7D2] shadow-2xs">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt={m.nickname || m.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{(m.nickname || m.full_name || 'U').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          {isTopHelper && (
                            <div 
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FFB300] text-white flex items-center justify-center shadow-xs text-[9px]"
                              title={language === 'th' ? 'อันดับ 1 คะแนนสูงสุด' : 'Top Points Leader'}
                            >
                              👑
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-outfit font-bold text-[14.5px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                              {m.nickname || m.full_name}
                            </h4>
                            {isMe && (
                              <span className="text-[10px] font-dm-sans font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                {language === 'th' ? 'คุณ' : 'You'}
                              </span>
                            )}
                          </div>
                          {m.bio ? (
                            <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] truncate max-w-[160px] mt-0.5">
                              {m.bio}
                            </p>
                          ) : (
                            <p className="font-dm-sans text-[11px] text-[#8D6E63]/70 dark:text-[#948D87]/70 truncate mt-0.5">
                              {language === 'th' ? 'สมาชิกในบ้าน' : 'Household Member'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Points Badge */}
                      <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-gradient-to-r from-[#FFF8E1] to-[#FFF3E0] dark:from-[#2B2317] dark:to-[#241A12] border border-[#FFE082] dark:border-[#534323] shadow-2xs">
                          <Star className="w-3.5 h-3.5 text-[#FF9800] fill-[#FF9800]" />
                          <span className="font-outfit font-black text-[14px] text-[#E65100]">
                            {points}
                          </span>
                          <span className="font-dm-sans font-bold text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                            {language === 'th' ? 'แต้ม' : 'pts'}
                          </span>
                        </div>
                        <span className="text-[9.5px] font-dm-sans text-[#8D6E63]/80 dark:text-[#948D87]/80 mt-0.5">
                          {language === 'th' ? 'คะแนนสะสม' : 'Chore balance'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[18px]">
                <p className="text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                  {language === 'th' 
                    ? 'คุณเป็นคนแรกในบ้าน แชร์รหัสคำเชิญด้านบนเพื่อให้สมาชิกคนอื่นเข้าร่วมได้ทันที' 
                    : 'You are the first member! Share your code above to invite others.'}
                </p>
              </div>
            )}
          </div>

          {/* Points Tip Box */}
          <div className="p-3 rounded-[16px] bg-[#FFF8E1]/80 dark:bg-[#221C16] border border-[#FFE082]/60 dark:border-[#423522] flex items-start gap-2 text-[11px] font-dm-sans text-[#8D6E63] dark:text-[#A8988B]">
            <Sparkles className="w-4 h-4 text-[#FFB300] shrink-0 mt-0.5" />
            <span>
              {language === 'th'
                ? 'คะแนนสะสมจะเพิ่มขึ้นเมื่อกดทำงานบ้านเสร็จในหน้างายบ้าน และนำไปแลกของรางวัลในร้านค้าได้'
                : 'Points increase upon completing chores and can be spent in the Rewards Shop.'}
            </span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. JOIN ANOTHER HOUSEHOLD FORM                           */}
        {/* ======================================================== */}
        <section className="bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] p-5 shadow-xs transition-colors space-y-3">
          <h3 className="font-outfit font-bold text-[15px] text-[#5D4037] dark:text-[#DDD7D2]">
            {language === 'th' ? 'ย้ายหรือเข้าร่วมบ้านอื่น' : 'Join Another Household'}
          </h3>
          <p className="font-dm-sans text-[11.5px] text-[#8D6E63] dark:text-[#948D87]">
            {language === 'th' 
              ? 'หากคุณต้องการย้ายไปอยู่บ้านของคนอื่น กรุณากรอกรหัสคำเชิญ 8 หลัก' 
              : 'Enter an 8-digit invite code to join a different household.'}
          </p>

          <form onSubmit={handleJoinHousehold} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder={language === 'th' ? 'กรอกรหัส 8 หลัก' : 'Enter 8-digit code'}
                className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] font-bold text-[#5D4037] dark:text-[#DDD7D2] uppercase tracking-wider focus:outline-none focus:border-[#5D4037]"
              />
              <button
                type="submit"
                disabled={isJoining || !joinCodeInput.trim()}
                className="px-4 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[14px] text-[13px] font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-xs shrink-0"
              >
                {isJoining ? '...' : (language === 'th' ? 'เข้าร่วม' : 'Join')}
              </button>
            </div>
          </form>
        </section>

        {/* ======================================================== */}
        {/* 4. LINK TO PROFILE PAGE                                  */}
        {/* ======================================================== */}
        <div className="pt-1">
          <Link
            href="/profile"
            className="w-full p-4 bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] hover:border-[#5D4037] rounded-[20px] flex items-center justify-between transition-all group shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#5D4037] text-white flex items-center justify-center shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-outfit font-bold text-[14px] text-[#5D4037] dark:text-[#DDD7D2]">
                  {language === 'th' ? 'ไปที่หน้าตั้งค่าบัญชีส่วนตัว' : 'Go to Profile Settings'}
                </h4>
                <p className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                  {language === 'th' ? 'เปลี่ยนรูปโปรไฟล์ ชื่อเล่น ธีมสี และภาษา' : 'Update avatar, nickname, theme & language'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8D6E63] group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
