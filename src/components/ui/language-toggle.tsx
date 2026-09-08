'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/language-context';
import { Globe } from 'lucide-react';

interface LanguageToggleProps {
  className?: string;
  showIcon?: boolean;
}

export function LanguageToggle({ className = '', showIcon = true }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selector"
      className={`inline-flex items-center p-1 bg-[#F4EFEA] border border-[#D7CCC8] rounded-full shadow-xs transition-colors ${className}`}
    >
      {showIcon && (
        <Globe className="w-3.5 h-3.5 ml-1.5 mr-1 text-[#8D6E63]" strokeWidth={2.2} />
      )}
      <button
        type="button"
        onClick={() => setLanguage('th')}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-150 ${
          language === 'th'
            ? 'bg-[#5D4037] text-white font-bold shadow-xs'
            : 'text-[#8D6E63] hover:text-[#5D4037]'
        }`}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-150 ${
          language === 'en'
            ? 'bg-[#5D4037] text-white font-bold shadow-xs'
            : 'text-[#8D6E63] hover:text-[#5D4037]'
        }`}
      >
        EN
      </button>
    </div>
  );
}
