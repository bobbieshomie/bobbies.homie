'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { RiBearSmileFill } from '@remixicon/react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageToggle } from '@/components/ui/language-toggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/dashboard';
  const { t } = useLanguage();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isEmail = identifier.includes('@');

  const setSessionCookie = (userVal: string) => {
    document.cookie = `homie_session=${encodeURIComponent(userVal)}; path=/; max-age=604800; SameSite=Lax`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanIdentifier = identifier.trim().toLowerCase();

    // If Supabase is not configured (offline / local development mode)
    if (!isSupabaseConfigured()) {
      setSessionCookie(cleanIdentifier);
      setSuccessMsg(t.auth.signInSuccess);
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 500);
      return;
    }

    const supabase = createClient();
    let emailToUse = cleanIdentifier;

    if (!isEmail) {
      try {
        const { data: resolvedEmail } = await supabase.rpc('get_email_by_username', {
          p_username: cleanIdentifier,
        });

        if (resolvedEmail) {
          emailToUse = resolvedEmail;
        } else {
          // If no email found in profile, try identifier as email directly
          emailToUse = `${cleanIdentifier}@bobbies.local`;
        }
      } catch (err) {
        console.warn('Username lookup notice:', err);
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMsg(t.auth.invalidLoginError);
      } else {
        setErrorMsg(error.message);
      }
      setLoading(false);
    } else {
      setSessionCookie(cleanIdentifier);
      setSuccessMsg(t.auth.signInSuccess);
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 500);
    }
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
        <div className="text-center space-y-2 mb-6">
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
          <div className="flex-1 py-2 text-center text-[13px] font-bold font-dm-sans bg-white text-[#5D4037] rounded-[14px] shadow-sm">
            {t.auth.signIn}
          </div>
          <Link
            href="/register"
            className="flex-1 py-2 text-center text-[13px] font-medium font-dm-sans text-[#8D6E63] hover:text-[#5D4037] rounded-[14px] transition-colors"
          >
            {t.auth.register}
          </Link>
        </div>

        {/* Login Card */}
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

          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Username or Email Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-dm-sans text-[13px] font-semibold text-[#5D4037]">
                  {t.auth.usernameOrEmail}
                </label>
                {identifier.trim() && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFEBE9] text-[#8D6E63]">
                    {isEmail ? t.auth.email : t.auth.username}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8D6E63]">
                  <User className="w-4 h-4 stroke-[#8D6E63]" />
                </div>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t.auth.usernameOrEmail}
                  className="w-full pl-10 pr-4 py-3 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[16px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037] transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-dm-sans text-[13px] font-semibold text-[#5D4037]">
                  {t.auth.password}
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8D6E63]">
                  <Lock className="w-4 h-4 stroke-[#8D6E63]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.password}
                  className="w-full pl-10 pr-10 py-3 text-[14px] font-dm-sans bg-white border border-[#D7CCC8] rounded-[16px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8D6E63] hover:text-[#5D4037]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                  <span>{t.auth.signIn}</span>
                  <ArrowRight className="w-4 h-4 stroke-[#FDFBF7]" strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-5 space-y-2 text-center">
          <div>
            <Link
              href="/register"
              className="font-dm-sans text-[13px] font-medium text-[#5D4037] hover:underline"
            >
              {t.auth.dontHaveAccount}{' '}
              <span className="font-bold underline">{t.auth.register}</span>
            </Link>
          </div>
          <div>
            <Link
              href="/join"
              className="inline-flex items-center gap-1 font-dm-sans text-[12px] text-[#8D6E63] hover:text-[#5D4037] hover:underline"
            >
              <KeyRound className="w-3.5 h-3.5 stroke-current" />
              <span>{t.auth.haveInviteCode}</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Mobile Bottom Home Indicator */}
      <div className="w-full flex justify-center pb-2 pt-1">
        <div className="w-[140px] h-[5px] bg-[#5D4037]/30 rounded-full" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="w-8 h-8 border-3 border-[#5D4037] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
