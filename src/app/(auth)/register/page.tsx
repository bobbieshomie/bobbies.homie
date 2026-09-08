'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Mail,
  Home, 
  KeyRound, 
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { RiBearSmileFill } from '@remixicon/react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageToggle } from '@/components/ui/language-toggle';

function RegisterForm() {
  const router = useRouter();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Household setup mode: create new home vs join existing
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('Our Sweet Home');
  const [inviteCode, setInviteCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const setSessionCookie = (userVal: string) => {
    document.cookie = `homie_session=${encodeURIComponent(userVal)}; path=/; max-age=604800; SameSite=Lax`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form Validation (Clean without parentheses)
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg(t.auth.usernameLengthError);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMsg(t.auth.usernameFormatError);
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t.auth.passwordLengthError);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t.auth.passwordMismatchError);
      return;
    }
    if (householdMode === 'join' && !inviteCode.trim()) {
      setErrorMsg(t.auth.inviteCodeRequired);
      return;
    }

    setLoading(true);

    // If Supabase is not configured (offline / local dev preview)
    if (!isSupabaseConfigured()) {
      setSessionCookie(cleanUsername);
      setSuccessMsg(t.auth.registerSuccess);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 700);
      return;
    }

    const supabase = createClient();

    // Check if username is already taken
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existingProfile) {
        setErrorMsg(t.auth.usernameTakenError);
        setLoading(false);
        return;
      }
    } catch {
      // Non-blocking in case of network issue
    }

    // Pre-validate invite code if joining
    if (householdMode === 'join') {
      try {
        const { data: foundH } = await supabase
          .from('households')
          .select('id')
          .eq('invite_code', inviteCode.trim().toUpperCase())
          .maybeSingle();

        if (!foundH) {
          setErrorMsg(t.auth.invalidInviteCode);
          setLoading(false);
          return;
        }
      } catch {
        // Continue if network check fails
      }
    }

    // Call Supabase Auth SignUp with complete metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim() || cleanUsername,
          nickname: fullName.trim() || cleanUsername,
          username: cleanUsername,
          household_mode: householdMode,
          household_name: householdName.trim() || 'Bobbies Homie',
          invite_code: inviteCode.trim().toUpperCase(),
        },
      },
    });

    if (authError) {
      setErrorMsg(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.session) {
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
    }

    const userId = authData.user?.id;
    if (userId) {
      try {
        // Verify profile and household linkage
        const { data: profile } = await supabase
          .from('profiles')
          .select('household_id')
          .eq('id', userId)
          .maybeSingle();

        if (!profile?.household_id) {
          if (householdMode === 'join' && inviteCode.trim()) {
            await supabase.rpc('join_household_by_invite', {
              invite_code_input: inviteCode.trim().toUpperCase(),
            });
          } else {
            await supabase.rpc('create_household_and_join', {
              household_name: householdName.trim() || 'Bobbies Homie',
            });
          }
        }
      } catch (dbErr) {
        console.warn('Profile/Household verification notice:', dbErr);
      }
    }

    setSessionCookie(cleanUsername);
    setSuccessMsg(t.auth.registerSuccess);
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 700);
  };

  return (
    <div className="flex flex-col justify-between min-h-screen p-0 select-none bg-[#FDFBF7]">
      {/* Top Bar with Language Selector */}
      <div className="flex flex-row justify-end items-center px-6 pt-4 pb-2 w-full max-w-[402px] mx-auto">
        <LanguageToggle />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-4 max-w-[402px] w-full mx-auto">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[22px] bg-[#F4EFEA] border border-[#D7CCC8] shadow-[0px_4px_16px_rgba(93,64,55,0.06)] text-[#5D4037]">
            <RiBearSmileFill className="w-8 h-8 fill-[#5D4037]" />
          </div>
          <h1 className="font-outfit font-bold text-[28px] leading-[35px] text-[#5D4037]">
            Bobbies Homie
          </h1>
          <p className="font-dm-sans text-[14px] leading-[18px] text-[#8D6E63]">
            {t.auth.welcomeSubtitle}
          </p>
        </div>

        {/* Auth Mode Tabs (Sign In / Register) */}
        <div className="flex items-center bg-[#F4EFEA] p-1 rounded-[18px] border border-[#D7CCC8] mb-5">
          <Link
            href="/login"
            className="flex-1 py-2 text-center text-[13px] font-medium font-dm-sans text-[#8D6E63] hover:text-[#5D4037] rounded-[14px] transition-colors"
          >
            {t.auth.signIn}
          </Link>
          <div className="flex-1 py-2 text-center text-[13px] font-bold font-dm-sans bg-white text-[#5D4037] rounded-[14px] shadow-sm">
            {t.auth.register}
          </div>
        </div>

        {/* Register Card */}
        <div className="bg-[#F4EFEA] border border-[#D7CCC8] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] p-5 space-y-4">
          
          {/* Alerts */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-[14px]">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3 text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-[14px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Full Name Input */}
            <div>
              <label className="block font-dm-sans text-[13px] font-semibold text-[#5D4037] mb-1.5">
                {t.auth.fullNameOrNickname}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8D6E63]">
                  <User className="w-4 h-4 stroke-[#8D6E63]" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.auth.fullNameOrNickname}
                  className="w-full pl-10 pr-4 py-2.5 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[16px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
                />
              </div>
            </div>

            {/* Username Input */}
            <div>
              <label className="block font-dm-sans text-[13px] font-semibold text-[#5D4037] mb-1.5">
                {t.auth.username}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8D6E63]">
                  <User className="w-4 h-4 stroke-[#8D6E63]" />
                </div>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.auth.username}
                  className="w-full pl-10 pr-4 py-2.5 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[16px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label className="block font-dm-sans text-[13px] font-semibold text-[#5D4037] mb-1.5">
                {t.auth.email}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8D6E63]">
                  <Mail className="w-4 h-4 stroke-[#8D6E63]" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.email}
                  className="w-full pl-10 pr-4 py-2.5 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[16px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
                />
              </div>
            </div>

            {/* Password Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-dm-sans text-[12px] font-semibold text-[#5D4037] mb-1">
                  {t.auth.password}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.password}
                  className="w-full px-3 py-2 text-[13px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[14px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block font-dm-sans text-[12px] font-semibold text-[#5D4037] mb-1">
                  {t.auth.confirmPassword}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.auth.confirmPassword}
                  className="w-full px-3 py-2 text-[13px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[14px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
                />
              </div>
            </div>

            {/* Household Setup Selector */}
            <div className="pt-2 border-t border-[#D7CCC8]/60">
              <label className="block font-dm-sans text-[12px] font-semibold text-[#5D4037] mb-2">
                {t.auth.householdSetup}
              </label>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setHouseholdMode('create')}
                  className={`py-2 px-2.5 rounded-[14px] text-[12px] font-medium border text-center transition-all ${
                    householdMode === 'create'
                      ? 'bg-white text-[#5D4037] border-[#5D4037] shadow-xs'
                      : 'bg-[#F4EFEA] text-[#8D6E63] border-[#D7CCC8]'
                  }`}
                >
                  <Home className="w-4 h-4 mx-auto mb-1 stroke-current" />
                  {t.auth.createHousehold}
                </button>

                <button
                  type="button"
                  onClick={() => setHouseholdMode('join')}
                  className={`py-2 px-2.5 rounded-[14px] text-[12px] font-medium border text-center transition-all ${
                    householdMode === 'join'
                      ? 'bg-white text-[#5D4037] border-[#5D4037] shadow-xs'
                      : 'bg-[#F4EFEA] text-[#8D6E63] border-[#D7CCC8]'
                  }`}
                >
                  <KeyRound className="w-4 h-4 mx-auto mb-1 stroke-current" />
                  {t.auth.joinHousehold}
                </button>
              </div>

              {householdMode === 'create' ? (
                <div>
                  <input
                    type="text"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    placeholder={t.auth.householdName}
                    className="w-full px-3.5 py-2.5 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[14px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder={t.auth.inviteCode}
                    className="w-full px-3.5 py-2.5 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[14px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037] uppercase tracking-wider"
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-2 bg-[#5D4037] hover:bg-[#4E342E] text-[#FDFBF7] font-dm-sans font-semibold text-[14px] rounded-[16px] transition-all shadow-[0_4px_14px_rgba(93,64,55,0.2)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#FDFBF7] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t.auth.register}</span>
                  <ArrowRight className="w-4 h-4 stroke-[#FDFBF7]" strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="font-dm-sans text-[13px] font-medium text-[#5D4037] hover:underline"
          >
            {t.auth.alreadyHaveAccount}{' '}
            <span className="font-bold underline">{t.auth.signIn}</span>
          </Link>
        </div>

      </div>

      {/* Mobile Bottom Home Indicator */}
      <div className="w-full flex justify-center pb-2 pt-1">
        <div className="w-[140px] h-[5px] bg-[#5D4037]/30 rounded-full" />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="w-8 h-8 border-3 border-[#5D4037] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
