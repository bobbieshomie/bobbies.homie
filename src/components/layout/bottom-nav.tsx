'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  ShoppingCart, 
  Calendar, 
  PawPrint, 
  Wallet 
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs = [
    { name: t.nav.home, href: '/dashboard', icon: Home },
    { name: t.nav.list, href: '/shopping', icon: ShoppingCart },
    { name: t.nav.calendar, href: '/calendar', icon: Calendar },
    { name: t.nav.pets, href: '/pets', icon: PawPrint },
    { name: t.nav.finance, href: '/finances', icon: Wallet },
  ];

  return (
    <footer className="w-full max-w-md sm:max-w-[448px] flex flex-col items-center select-none">
      {/* bottom-nav-container */}
      <div className="w-full px-6 pt-3 pb-2 flex justify-center">
        {/* bottom-nav-pill */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="w-[354px] h-[64px] bg-[#F4EFEA] dark:bg-[#5D4037] border border-[#D7CCC8] dark:border-[#7A5C52] shadow-[0px_4px_16px_rgba(93,64,55,0.10)] dark:shadow-[0px_4px_20px_rgba(0,0,0,0.35)] rounded-[32px] px-2 flex items-center justify-between transition-colors"
        >
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/dashboard'
                ? pathname === '/dashboard' || pathname === '/'
                : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-[20px] transition-all duration-200 ${
                  isActive
                    ? 'bg-[#FFFFFF] dark:bg-[#3E2A23] text-[#5D4037] dark:text-[#FDFBF7] shadow-[0_2px_8px_rgba(0,0,0,0.15)] ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-[#5D4037]/70 dark:text-[#D7CCC8]/80 hover:text-[#5D4037] dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <Icon
                  className="w-5 h-5 stroke-current"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className={`font-dm-sans text-[10px] leading-[13px] mt-0.5 ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {tab.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* home-indicator-container */}
      <div className="w-full flex justify-center pb-2 pt-0.5">
        <div className="w-[140px] h-[5px] bg-[#5D4037]/40 rounded-full" />
      </div>
    </footer>
  );
}
