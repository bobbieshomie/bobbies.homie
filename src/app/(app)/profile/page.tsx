'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Camera, 
  Check, 
  LogOut, 
  Home, 
  Moon, 
  Sun, 
  Users,
  Globe,
  ChevronRight,
  Star
} from 'lucide-react';
import { useAppStore } from '@/features/shared/stores/use-app-store';
import { useLanguage } from '@/lib/i18n/language-context';
import { useTheme } from '@/lib/theme/theme-context';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { 
  fetchProfile, 
  updateProfile as updateDbProfile, 
  fetchHousehold, 
  fetchHouseholdMembers, 
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState(profile.name || '');
  const [nickname, setNickname] = useState(profile.myNickname || '');
  const [bio, setBio] = useState(profile.myBio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.myAvatarUrl || null);
  
  // Household summary states
  const [household, setHousehold] = useState<DbHousehold | null>(null);
  const [householdName, setHouseholdName] = useState(profile.name || 'Bobbies Homie');
  const [members, setMembers] = useState<DbProfile[]>([]);

  // Status feedback
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
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
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const msg = err instanceof Error ? err.message : (language === 'th' ? 'เกิดข้อผิดพลาดในการอัปโหลด' : 'Failed to upload avatar');
      setStatusMessage({ type: 'error', text: msg });
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
      }

      setStoreProfile({
        myNickname: nickname.trim() || fullName.trim(),
        myBio: bio.trim(),
        myAvatarUrl: avatarUrl,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving profile';
      setStatusMessage({ type: 'error', text: msg });
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
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Bar */}
      <div className="px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2]">
            {language === 'th' ? 'บัญชีและการตั้งค่า' : 'Account & Settings'}
          </h1>
          <p className="font-dm-sans text-[12px] leading-normal text-[#8D6E63] dark:text-[#948D87] mt-1.5">
            {language === 'th' ? 'จัดการข้อมูลส่วนตัว ธีมสี และภาษาของแอป' : 'Manage your profile details, theme & language'}
          </p>
        </div>

        {/* Tab Switcher: Profile vs Household */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-[#F4EFEA] dark:bg-[#201D1A] rounded-[16px] border border-[#D7CCC8]/60 dark:border-[#2E2A27]">
          <div className="py-2 px-3 rounded-[12px] font-outfit text-[12.5px] font-bold text-center bg-white dark:bg-[#2E2A27] text-[#5D4037] dark:text-[#FDFBF7] shadow-xs">
            {language === 'th' ? '👤 บัญชีส่วนตัว' : '👤 Profile'}
          </div>
          <Link
            href="/household"
            className="py-2 px-3 rounded-[12px] font-outfit text-[12.5px] font-bold text-center text-[#8D6E63] dark:text-[#948D87] hover:bg-white/60 dark:hover:bg-[#2E2A27]/60 transition-all"
          >
            {language === 'th' ? '🏠 บ้านและสมาชิก' : '🏠 Household'}
          </Link>
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

      {savedSuccess && (
        <div className="mx-6 my-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-[14px] text-[13px] font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{language === 'th' ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'Settings saved successfully'}</span>
        </div>
      )}

      <div className="flex-1 px-6 space-y-4 pt-2">
        {/* ======================================================== */}
        {/* 1. SEPARATED HOUSEHOLD SETTINGS LINK CARD                */}
        {/* ======================================================== */}
        <Link
          href="/household"
          className="block p-4.5 bg-gradient-to-r from-[#F4EFEA] via-[#EFE8E1] to-[#F4EFEA] dark:from-[#1F1D1B] dark:via-[#26221F] dark:to-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] hover:border-[#5D4037] dark:hover:border-[#6E544A] rounded-[24px] shadow-xs transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-[14px] bg-[#5D4037] dark:bg-[#6E544A] text-[#FFD54F] flex items-center justify-center shadow-xs shrink-0">
                <Home className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-outfit font-bold text-[15.5px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                    {householdName || 'บ้านของเรา'}
                  </h3>
                  <span className="text-[10.5px] font-dm-sans font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#141312] text-[#8D6E63] dark:text-[#948D87] border border-[#D7CCC8]/60 dark:border-[#2E2A27] shrink-0">
                    {members.length} {language === 'th' ? 'คนในบ้าน' : 'members'}
                  </span>
                </div>
                <p className="font-dm-sans text-[11.5px] text-[#8D6E63] dark:text-[#948D87] mt-0.5 flex items-center gap-1 truncate">
                  <Star className="w-3 h-3 text-[#FFB300] fill-[#FFB300] shrink-0" />
                  <span className="truncate">
                    {language === 'th'
                      ? 'ดูคะแนนสะสมคนในบ้าน & ตั้งค่าบ้าน ➔'
                      : 'View member points & household settings ➔'}
                  </span>
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#8D6E63] dark:text-[#948D87] group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
          </div>
        </Link>

        {/* ======================================================== */}
        {/* 2. Profile & Avatar Card                                 */}
        {/* ======================================================== */}
        <section className="bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] p-5 shadow-xs transition-colors">
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar with Camera Trigger */}
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#D7CCC8] dark:bg-[#2E2A27] border-2 border-white dark:border-[#2E2A27] shadow-sm flex items-center justify-center text-[24px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
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
                className="absolute bottom-0 right-0 p-2 bg-[#5D4037] dark:bg-[#6E544A] text-white rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
              <h2 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                {nickname || fullName || (language === 'th' ? 'ผู้ใช้งาน' : 'User')}
              </h2>
              <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87] truncate">
                {currentUser?.email || (language === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-[12px] font-medium text-[#5D4037] dark:text-[#948D87] underline cursor-pointer"
              >
                {language === 'th' ? 'เปลี่ยนรูปภาพ' : 'Upload photo'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                {language === 'th' ? 'ชื่อ หรือ ชื่อเล่นของคุณ' : 'Full Name or Nickname'}
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={language === 'th' ? 'ชื่อเล่น' : 'Nickname'}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037] dark:focus:border-[#D7CCC8]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                {language === 'th' ? 'ข้อความสั้นๆ ถึงสมาชิกในบ้าน' : 'Bio & Status'}
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={language === 'th' ? 'เช่น พร้อมดูแลบ้านเสมอ' : 'e.g. Always ready to help'}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037] dark:focus:border-[#D7CCC8]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[14px] text-[13px] font-bold shadow-xs transition-colors cursor-pointer"
            >
              {language === 'th' ? 'บันทึกข้อมูลส่วนตัว' : 'Save Profile Details'}
            </button>
          </form>
        </section>

        {/* 3. Theme Customization (Light vs Deep Warm Brown Dark) */}
        <section className="bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] p-5 shadow-xs transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-[#FDFBF7]" />
              ) : (
                <Sun className="w-5 h-5 text-[#5D4037]" />
              )}
              <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'ธีมสีของแอปพลิเคชัน' : 'Appearance & Theme'}
              </h3>
            </div>
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#141312] text-[#5D4037] dark:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#2E2A27]">
              {theme === 'dark' ? (language === 'th' ? 'สีน้ำตาลมอคค่า' : 'Mocha Brown') : (language === 'th' ? 'สว่างครีม' : 'Light Cream')}
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

            {/* Dark Mode Option (Charcoal Warm / Mocha Slate) */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3.5 rounded-[18px] border text-left transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#1F1D1B] text-[#DDD7D2] border-[#6E544A] shadow-md ring-2 ring-[#6E544A]/40'
                  : 'bg-[#1F1D1B]/80 text-[#948D87] border-[#2E2A27] hover:bg-[#1F1D1B]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Moon className="w-5 h-5 text-[#DDD7D2]" />
                <div className="flex gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#141312] border border-[#2E2A27]" />
                  <span className="w-3 h-3 rounded-full bg-[#1F1D1B] border border-[#6E544A]" />
                  <span className="w-3 h-3 rounded-full bg-[#DDD7D2]" />
                </div>
              </div>
              <p className="font-outfit font-bold text-[14px]">
                {language === 'th' ? 'โหมดมืด (Charcoal)' : 'Dark Theme'}
              </p>
              <p className="font-dm-sans text-[11px] text-[#948D87] mt-0.5">
                {language === 'th' ? 'ชาร์โคลอุ่น สบายตาสูงสุด' : 'Charcoal warm slate'}
              </p>
            </button>
          </div>
        </section>

        {/* 4. Language Selection */}
        <section className="bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] p-5 shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-[#5D4037] dark:text-[#DDD7D2]" />
            <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
              {t.profile.languageSetting}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setLanguage('th')}
              className={`py-3 px-3 rounded-[16px] text-[13px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                language === 'th'
                  ? 'bg-white dark:bg-[#141312] text-[#5D4037] dark:text-[#DDD7D2] border-[#5D4037] dark:border-[#D7CCC8] shadow-xs ring-2 ring-[#5D4037]/20 dark:ring-[#948D87]/20'
                  : 'bg-[#F4EFEA] dark:bg-[#1F1D1B] text-[#8D6E63] dark:text-[#948D87] border-[#D7CCC8] dark:border-[#2E2A27] hover:bg-white/60 dark:hover:bg-[#2A1B16]/60'
              }`}
            >
              <span>ภาษาไทย (TH)</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`py-3 px-3 rounded-[16px] text-[13px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                language === 'en'
                  ? 'bg-white dark:bg-[#141312] text-[#5D4037] dark:text-[#DDD7D2] border-[#5D4037] dark:border-[#D7CCC8] shadow-xs ring-2 ring-[#5D4037]/20 dark:ring-[#948D87]/20'
                  : 'bg-[#F4EFEA] dark:bg-[#1F1D1B] text-[#8D6E63] dark:text-[#948D87] border-[#D7CCC8] dark:border-[#2E2A27] hover:bg-white/60 dark:hover:bg-[#2A1B16]/60'
              }`}
            >
              <span>English (EN)</span>
            </button>
          </div>
        </section>

        {/* 5. Logout Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 bg-[#F4EFEA] dark:bg-[#1F1D1B] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-[18px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.profile.logOut}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
