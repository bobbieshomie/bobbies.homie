'use client';

import { RiBearSmileFill } from '@remixicon/react';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useAppStore } from '@/features/shared/stores/use-app-store';

interface AppHeaderProps {
  householdName?: string;
  partnerNickname?: string;
  partnerAvatarUrl?: string;
  partnerIsOnline?: boolean;
}

export function AppHeader({
  householdName,
  partnerNickname,
  partnerAvatarUrl,
  partnerIsOnline = true,
}: AppHeaderProps) {
  const profile = useAppStore((state) => state.profile);

  const displayHousehold = householdName || profile.name || 'Our Home';
  const displayPartner = partnerNickname || profile.partnerNickname || 'Partner';

  return (
    <div className="flex items-center justify-between h-14 px-4 bg-[#FDFBF7] dark:bg-[#1F1511] border-b border-[#D7CCC8]/50 dark:border-[#4E342E]/50 transition-colors">
      {/* Brand & Household Name */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] text-[#5D4037] dark:text-[#F5EBE6]">
          <RiBearSmileFill className="w-5 h-5 fill-[#5D4037] dark:fill-[#F5EBE6]" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-[#5D4037] dark:text-[#F5EBE6] font-outfit">
            {displayHousehold}
          </h1>
        </div>
      </div>

      {/* Language Switcher & Partner Actions */}
      <div className="flex items-center space-x-2.5">
        <LanguageToggle />

        {/* Partner Avatar / Status */}
        <div className="relative flex items-center space-x-1.5 px-2 py-1 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-full text-xs text-[#5D4037] dark:text-[#F5EBE6]">
          <div className="relative w-5 h-5 rounded-full overflow-hidden bg-[#D7CCC8] dark:bg-[#4E342E] text-[#5D4037] dark:text-[#F5EBE6] flex items-center justify-center text-[10px] font-bold">
            {partnerAvatarUrl ? (
              <img src={partnerAvatarUrl} alt={displayPartner} className="w-full h-full object-cover" />
            ) : (
              displayPartner.charAt(0).toUpperCase()
            )}
          </div>
          <span className="font-medium text-[11px] max-w-[50px] truncate">{displayPartner}</span>
          {partnerIsOnline && (
            <span className="w-2 h-2 rounded-full bg-[#2E7D32] ring-2 ring-white dark:ring-[#2D1E18]" />
          )}
        </div>
      </div>
    </div>
  );
}
