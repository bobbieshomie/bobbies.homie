'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Camera, 
  Copy, 
  Check, 
  LogOut, 
  Home, 
  User, 
  Moon, 
  Sun, 
  KeyRound, 
  Plus, 
  Users,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { useLanguage } from '@/lib/i18n/language-context';
import { useTheme } from '@/lib/theme/theme-context';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchProfile, 
  updateProfile as updateDbProfile, 
  fetchHousehold, 
  fetchHouseholdMembers, 
  joinHouseholdByCode, 
  updateProfile,
  type DbProfile, 
  type DbHousehold 
} from '@/lib/services/db';
import { uploadAvatar } from '@/lib/services/storage';

export default function AccountPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const profile = useAppStore((state) => state.profile);
  const setStoreProfile = useAppStore((state) => state.updateProfile);

  // Local states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [fullName, setFullName] = useState(profile.name || '');
  const [nickname, setNickname] = useState(profile.myNickname || '');
  const [bio, setBio] = useState(profile.myBio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.myAvatarUrl || null);
  
  // Household states
  const [household, setHousehold] = useState<DbHousehold | null>(null);
  const [householdName, setHouseholdName] = useState(profile.name || 'Bobbies Homie');
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Status feedback
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Load active user & household from Supabase
  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          const dbProf = await fetchProfile(user.id);
          if (dbProf) {
            setFullName(dbProf.full_name || '');
            setNickname(dbProf.nickname || '');
            setBio(dbProf.bio || '');
            setAvatarUrl(dbProf.avatar_url);

            if (dbProf.household_id) {
              const h = await fetchHousehold(dbProf.household_id);
              if (h) {
                setHousehold(h);
                setHouseholdName(h.name);
              }
              const mems = await fetchHouseholdMembers(dbProf.household_id);
              setMembers(mems);
            }
          }
        }
      } catch (err) {
        console.warn('Load user data notice:', err);
      }
    }

    loadUserData();
  }, []);

  // Copy household invite code
  const handleCopyCode = () => {
    const codeToCopy = household?.invite_code || profile.inviteCode || '';
    if (!codeToCopy) return;
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Avatar file upload handler
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setStatusMessage(null);

    try {
      const userId = currentUser?.id || 'guest-user';
      const uploadedUrl = await uploadAvatar(file, userId);
      setAvatarUrl(uploadedUrl);

      // Update in Supabase if logged in
      if (currentUser?.id) {
        await updateDbProfile(currentUser.id, { avatar_url: uploadedUrl });
      }

      // Update in Zustand store
      setStoreProfile({ myAvatarUrl: uploadedUrl });
      setStatusMessage({ type: 'success', text: language === 'th' ? 'อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว' : 'Avatar updated successfully' });
    } catch (err: any) {
      console.error('Upload error:', err);
      setStatusMessage({ type: 'error', text: err.message || (language === 'th' ? 'เกิดข้อผิดพลาดในการอัปโหลด' : 'Failed to upload avatar') });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save profile info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    try {
      if (currentUser?.id) {
        await updateDbProfile(currentUser.id, {
          full_name: fullName.trim(),
          nickname: nickname.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
        });

        if (household?.id && householdName.trim() !== household.name) {
          const supabase = createClient();
          await supabase
            .from('households')
            .update({ name: householdName.trim() })
            .eq('id', household.id);
        }
      }

      setStoreProfile({
        name: householdName.trim(),
        myNickname: nickname.trim() || fullName.trim(),
        myBio: bio.trim(),
        myAvatarUrl: avatarUrl,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error saving profile' });
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
      setMembers(newMems);

      setJoinCodeInput('');
      setStatusMessage({ 
        type: 'success', 
        text: language === 'th' ? `เข้าร่วมบ้าน "${joinedH.name}" เรียบร้อยแล้ว` : `Joined "${joinedH.name}" successfully` 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Invalid invite code' });
    } finally {
      setIsJoining(false);
    }
  };

  // Log Out
  const handleLogout = async () => {
    document.cookie = 'homie_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // safe fallback
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] select-none max-w-[402px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Bar */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-[30px] text-[#5D4037] dark:text-[#F5EBE6]">
            {language === 'th' ? 'บัญชีและการตั้งค่า' : 'Account & Settings'}
          </h1>
          <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#BCAAA4]">
            {language === 'th' ? 'จัดการข้อมูลส่วนตัว สมาชิกบ้าน และธีม' : 'Manage profile, household members & theme'}
          </p>
        </div>
        <LanguageToggle />
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

      {savedSuccess && (
        <div className="mx-6 my-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-[14px] text-[13px] font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{language === 'th' ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'Settings saved successfully'}</span>
        </div>
      )}

      <div className="flex-1 px-6 space-y-4 pt-2">
        {/* 1. Profile & Avatar Card */}
        <section className="bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[24px] p-5 shadow-xs transition-colors">
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar with Camera Trigger */}
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#D7CCC8] dark:bg-[#4E342E] border-2 border-white dark:border-[#35231C] shadow-sm flex items-center justify-center text-[24px] font-bold text-[#5D4037] dark:text-[#F5EBE6]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{(nickname || fullName || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-2 bg-[#5D4037] dark:bg-[#D7CCC8] text-white dark:text-[#1F1511] rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={language === 'th' ? 'เปลี่ยนรูปโปรไฟล์' : 'Change avatar'}
              >
                {uploadingAvatar ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5 stroke-current" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#F5EBE6] truncate">
                {nickname || fullName || (language === 'th' ? 'ผู้ใช้งาน' : 'User')}
              </h2>
              <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#BCAAA4] truncate">
                {currentUser?.email || (language === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-[12px] font-medium text-[#5D4037] dark:text-[#D7CCC8] underline cursor-pointer"
              >
                {language === 'th' ? 'เปลี่ยนรูปภาพ' : 'Upload photo'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                {language === 'th' ? 'ชื่อ หรือ ชื่อเล่นของคุณ' : 'Full Name or Nickname'}
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={language === 'th' ? 'ชื่อเล่น' : 'Nickname'}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037] dark:focus:border-[#D7CCC8]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                {language === 'th' ? 'ข้อความสั้นๆ ถึงสมาชิกในบ้าน' : 'Bio & Status'}
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={language === 'th' ? 'เช่น พร้อมดูแลบ้านเสมอ' : 'e.g. Always ready to help'}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037] dark:focus:border-[#D7CCC8]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#5D4037] dark:bg-[#4E342E] hover:bg-[#4E342E] text-white rounded-[14px] text-[13px] font-bold shadow-xs transition-colors cursor-pointer"
            >
              {language === 'th' ? 'บันทึกข้อมูลส่วนตัว' : 'Save Profile Details'}
            </button>
          </form>
        </section>

        {/* 2. Household Management Card */}
        <section className="bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[24px] p-5 shadow-xs transition-colors space-y-4">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#5D4037] dark:text-[#F5EBE6]" />
            <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#F5EBE6]">
              {language === 'th' ? 'ข้อมูลบ้านของเรา' : 'Household Details'}
            </h3>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
              {language === 'th' ? 'ชื่อบ้านของคุณ' : 'Household Name'}
            </label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
            />
          </div>

          {/* Invite Code Box */}
          <div className="p-3.5 bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[18px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4]">
                {language === 'th' ? 'รหัสคำเชิญสำหรับสมาชิก' : 'Invite Code for Members'}
              </span>
              <span className="text-[11px] text-[#8D6E63] dark:text-[#BCAAA4]">
                {language === 'th' ? 'ให้รหัสนี้เพื่อให้คนอื่นเข้าร่วมบ้าน' : 'Share to add members'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <code className="font-dm-sans font-bold text-[18px] tracking-widest text-[#5D4037] dark:text-[#F5EBE6]">
                {household?.invite_code || '...'}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EFEA] dark:bg-[#2D1E18] hover:bg-[#D7CCC8] dark:hover:bg-[#4E342E] text-[#5D4037] dark:text-[#F5EBE6] rounded-[12px] text-[12px] font-semibold border border-[#D7CCC8] dark:border-[#4E342E] transition-all cursor-pointer"
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
          </div>

          {/* Household Members List */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#8D6E63] dark:text-[#BCAAA4]" />
              <span className="text-[13px] font-bold text-[#5D4037] dark:text-[#F5EBE6]">
                {language === 'th' ? 'สมาชิกในบ้านตอนนี้' : 'Household Members'} ({members.length || 1})
              </span>
            </div>

            <div className="space-y-2">
              {members.length > 0 ? (
                members.map((m) => (
                  <div 
                    key={m.id}
                    className="flex items-center justify-between p-2.5 bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#D7CCC8] dark:bg-[#4E342E] flex items-center justify-center text-[12px] font-bold text-[#5D4037] dark:text-[#F5EBE6]">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={m.nickname || m.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(m.nickname || m.full_name || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#5D4037] dark:text-[#F5EBE6]">
                          {m.nickname || m.full_name}
                        </p>
                        {m.id === currentUser?.id && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            ({language === 'th' ? 'คุณ' : 'You'})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 bg-[#F4EFEA] dark:bg-[#2D1E18] text-[#8D6E63] dark:text-[#BCAAA4] rounded-full">
                      {language === 'th' ? 'สมาชิก' : 'Member'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px]">
                  <p className="text-[12px] text-[#8D6E63] dark:text-[#BCAAA4]">
                    {language === 'th' 
                      ? 'คุณเป็นคนแรกในบ้าน แชร์รหัสคำเชิญด้านบนเพื่อให้สมาชิกคนอื่นเข้าร่วมได้ทันที' 
                      : 'You are the first member! Share your code above to invite others.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Join Another Household Form */}
          <form onSubmit={handleJoinHousehold} className="pt-2 border-t border-[#D7CCC8]/60 dark:border-[#4E342E]/60 space-y-2">
            <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4]">
              {language === 'th' ? 'ต้องการย้ายหรือเข้าร่วมบ้านอื่น' : 'Join Another Household'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder={language === 'th' ? 'กรอกรหัส 8 หลัก' : 'Enter 8-digit code'}
                className="flex-1 px-3.5 py-2 bg-white dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#F5EBE6] uppercase tracking-wider focus:outline-none focus:border-[#5D4037]"
              />
              <button
                type="submit"
                disabled={isJoining || !joinCodeInput.trim()}
                className="px-4 py-2 bg-[#5D4037] dark:bg-[#4E342E] text-white rounded-[14px] text-[13px] font-bold disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isJoining ? '...' : (language === 'th' ? 'เข้าร่วม' : 'Join')}
              </button>
            </div>
          </form>
        </section>

        {/* 3. Theme Customization (Light vs Deep Warm Brown Dark) */}
        <section className="bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[24px] p-5 shadow-xs transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-[#F5EBE6]" />
              ) : (
                <Sun className="w-5 h-5 text-[#5D4037]" />
              )}
              <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#F5EBE6]">
                {language === 'th' ? 'ธีมสีของแอปพลิเคชัน' : 'Appearance & Theme'}
              </h3>
            </div>
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] border border-[#D7CCC8] dark:border-[#4E342E]">
              {theme === 'dark' ? (language === 'th' ? 'สีน้ำตาลเข้ม' : 'Dark Brown') : (language === 'th' ? 'สว่างครีม' : 'Light Cream')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Light Mode Option */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3.5 rounded-[18px] border text-left transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-white text-[#5D4037] border-[#5D4037] shadow-md ring-2 ring-[#5D4037]/20'
                  : 'bg-white/60 text-[#8D6E63] border-[#D7CCC8] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Sun className="w-5 h-5 text-[#5D4037]" />
                <div className="flex gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#FDFBF7] border border-[#D7CCC8]" />
                  <span className="w-3 h-3 rounded-full bg-[#F4EFEA] border border-[#D7CCC8]" />
                  <span className="w-3 h-3 rounded-full bg-[#5D4037]" />
                </div>
              </div>
              <p className="font-outfit font-bold text-[14px]">
                {language === 'th' ? 'โหมดสว่าง (Light)' : 'Light Theme'}
              </p>
              <p className="font-dm-sans text-[11px] text-[#8D6E63] mt-0.5">
                {language === 'th' ? 'โทนครีมอบอุ่น นุ่มนวลตา' : 'Warm cream palette'}
              </p>
            </button>

            {/* Dark Mode Option (Deep Warm Brown) */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3.5 rounded-[18px] border text-left transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#1F1511] text-[#F5EBE6] border-[#D7CCC8] shadow-md ring-2 ring-[#D7CCC8]/40'
                  : 'bg-[#2D1E18]/80 text-[#BCAAA4] border-[#4E342E] hover:bg-[#2D1E18]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Moon className="w-5 h-5 text-[#F5EBE6]" />
                <div className="flex gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#1F1511] border border-[#4E342E]" />
                  <span className="w-3 h-3 rounded-full bg-[#2D1E18] border border-[#4E342E]" />
                  <span className="w-3 h-3 rounded-full bg-[#4E342E]" />
                </div>
              </div>
              <p className="font-outfit font-bold text-[14px]">
                {language === 'th' ? 'โหมดมืด (Dark)' : 'Dark Theme'}
              </p>
              <p className="font-dm-sans text-[11px] text-[#BCAAA4] mt-0.5">
                {language === 'th' ? 'โทนสีน้ำตาลเข้ม คลาสสิก' : 'Deep warm brown'}
              </p>
            </button>
          </div>
        </section>

        {/* 4. Language Selection */}
        <section className="bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[24px] p-5 shadow-xs transition-colors">
          <h3 className="font-outfit font-bold text-[15px] text-[#5D4037] dark:text-[#F5EBE6] mb-2">
            {t.profile.languageSetting}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLanguage('th')}
              className={`py-2 px-3 rounded-[14px] text-[13px] font-bold border transition-all cursor-pointer ${
                language === 'th'
                  ? 'bg-white dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] border-[#5D4037] dark:border-[#D7CCC8] shadow-xs'
                  : 'bg-[#F4EFEA] dark:bg-[#2D1E18] text-[#8D6E63] dark:text-[#BCAAA4] border-[#D7CCC8] dark:border-[#4E342E]'
              }`}
            >
              ภาษาไทย (TH)
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`py-2 px-3 rounded-[14px] text-[13px] font-bold border transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-white dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] border-[#5D4037] dark:border-[#D7CCC8] shadow-xs'
                  : 'bg-[#F4EFEA] dark:bg-[#2D1E18] text-[#8D6E63] dark:text-[#BCAAA4] border-[#D7CCC8] dark:border-[#4E342E]'
              }`}
            >
              English (EN)
            </button>
          </div>
        </section>

        {/* 5. Logout Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 bg-[#F4EFEA] dark:bg-[#2D1E18] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-[18px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.profile.logOut}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
