import { type ReactNode } from 'react';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';

interface MobileShellProps {
  children: ReactNode;
  header?: ReactNode;
  bottomNav?: ReactNode;
}

/**
 * MobileShell locks the viewport to mobile dimensions (402px width),
 * ensures notch/home-indicator safe-area padding (env(safe-area-inset-*)),
 * and sets the warm cozy #FDFBF7 background.
 */
export function MobileShell({ children, header, bottomNav }: MobileShellProps) {
  return (
    <div className="flex justify-center min-h-screen min-h-[100dvh] w-full bg-[#FDFBF7] dark:bg-[#1A1816] transition-colors">
      {/* Mobile container - responsive up to iPhone Pro Max (448px), 100% width on phones */}
      <div className="relative flex flex-col w-full max-w-md sm:max-w-[448px] min-h-screen min-h-[100dvh] bg-[#FDFBF7] dark:bg-[#1A1816] shadow-[0_8px_30px_rgba(93,64,55,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-x-hidden transition-colors">
        {/* Dynamic Mobile Header if provided */}
        {header && (
          <header className="sticky top-0 z-30 w-full bg-[#FDFBF7]/90 dark:bg-[#1A1816]/90 backdrop-blur-md border-b border-[#D7CCC8]/60 dark:border-[#2E2A27]/60 pt-[env(safe-area-inset-top,0px)]">
            {header}
          </header>
        )}

        {/* Scrollable Mobile Content Body with Pull-To-Refresh */}
        <PullToRefresh>
          {children}
        </PullToRefresh>

        {/* Floating Bottom Navigation Shell */}
        {bottomNav && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
            <div className="w-full max-w-md sm:max-w-[448px] pointer-events-auto bg-transparent">
              {bottomNav}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
