'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  KeyRound, 
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronLeft
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageToggle } from '@/components/ui/language-toggle';

export default function JoinPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setStatusMsg(null);

    // If Supabase is not configured (demo/offline mode)
    if (!isSupabaseConfigured()) {
      document.cookie = 'homie_session=partner_joined; path=/; max-age=604800; SameSite=Lax';
      setStatusMsg({ type: 'success', text: t.auth.joinSuccess });
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 700);
      return;
    }

    const supabase = createClient();
    const cleanCode = inviteCode.trim().toUpperCase();

    const { data: household, error: houseError } = await supabase
      .from('households')
      .select('id, name')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (houseError || !household) {
      setStatusMsg({ type: 'error', text: t.auth.invalidInviteCode });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ household_id: household.id })
        .eq('id', user.id);
    } else {
      localStorage.setItem('pending_invite_code', cleanCode);
    }

    document.cookie = `homie_session=joined_${cleanCode}; path=/; max-age=604800; SameSite=Lax`;
    setStatusMsg({ type: 'success', text: t.auth.joinSuccess });
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 700);
  };

  return (
    <div className="flex flex-col justify-between min-h-screen p-0 select-none bg-[#FDFBF7]">
      {/* Top Bar with Language Selector */}
      <div className="flex flex-row justify-between items-center px-6 pt-4 pb-2 w-full max-w-[402px] mx-auto">
        <Link
          href="/login"
          className="p-1.5 -ml-1.5 text-[#5D4037] hover:text-[#4A332C] rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 stroke-[#5D4037]" />
        </Link>
        <LanguageToggle />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-6 max-w-[402px] w-full mx-auto">
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[22px] bg-[#F4EFEA] border border-[#D7CCC8] shadow-[0px_4px_16px_rgba(93,64,55,0.06)] text-[#5D4037]">
            <KeyRound className="w-7 h-7 stroke-[#5D4037]" />
          </div>
          <h1 className="font-outfit font-bold text-[26px] leading-[32px] text-[#5D4037]">
            {t.auth.joinHouseholdTitle}
          </h1>
          <p className="font-dm-sans text-[14px] leading-[18px] text-[#8D6E63]">
            {t.auth.joinHouseholdSubtitle}
          </p>
        </div>

        {/* Join Card */}
        <div className="bg-[#F4EFEA] border border-[#D7CCC8] shadow-[0px_4px_16px_rgba(93,64,55,0.039)] rounded-[24px] p-5 space-y-4">
          {statusMsg && (
            <div
              className={`flex items-start gap-2.5 p-3 text-[13px] rounded-[14px] ${
                statusMsg.type === 'error'
                  ? 'text-rose-700 bg-rose-50 border border-rose-200'
                  : 'text-emerald-800 bg-emerald-50 border border-emerald-200'
              }`}
            >
              {statusMsg.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block font-dm-sans text-[13px] font-semibold text-[#5D4037] mb-1.5">
                {t.auth.inviteCode}
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder={t.auth.inviteCodePlaceholder}
                className="w-full px-4 py-3 text-[16px] font-dm-sans tracking-widest text-center uppercase bg-white border border-[#D7CCC8] rounded-[16px] text-[#5D4037] placeholder-[#A1887F] focus:outline-none focus:border-[#5D4037]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="w-full py-3.5 px-4 bg-[#5D4037] hover:bg-[#4E342E] text-[#FDFBF7] font-dm-sans font-semibold text-[14px] rounded-[16px] transition-all shadow-[0_4px_14px_rgba(93,64,55,0.2)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#FDFBF7] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t.auth.joinButton}</span>
                  <ArrowRight className="w-4 h-4 stroke-[#FDFBF7]" strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/login"
            className="font-dm-sans text-[13px] font-medium text-[#5D4037] hover:underline"
          >
            {t.auth.backToSignIn}
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
