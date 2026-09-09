'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface AppLoadingProps {
  /** Optional title or status text (e.g. 'Bobbies Homie' or 'กำลังออกจากระบบ...') */
  message?: string;
  /** Optional subtitle or detail message */
  subMessage?: string;
  /** Whether to show in fullscreen fixed overlay mode (default: true) */
  isFullScreen?: boolean;
  /** Duration of the bear fill animation in seconds (default: 1.8) */
  fillDuration?: number;
  /** Whether to show small loading... text (default: true) */
  showText?: boolean;
  className?: string;
}

function BearLogoSvg({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M17.5 2C19.9853 2 22 4.01472 22 6.5C22 7.85621 21.4001 9.07229 20.4511 9.89732C20.8061 10.8644 21 11.9096 21 13C21 17.9706 16.9706 22 12 22C7.02944 22 3 17.9706 3 13C3 11.9096 3.19392 10.8644 3.54916 9.8972C2.59995 9.07229 2 7.85621 2 6.5C2 4.01472 4.01472 2 6.5 2C8.12553 2 9.54976 2.86189 10.3406 4.15362C10.8774 4.05251 11.4326 4 12 4C12.5674 4 13.1226 4.05251 13.6609 4.15294C14.4502 2.86189 15.8745 2 17.5 2ZM10 13H8C8 15.2091 9.79086 17 12 17C14.2091 17 16 15.2091 16 13H14C14 14.1046 13.1046 15 12 15C10.8954 15 10 14.1046 10 13Z" />
    </svg>
  );
}

export function AppLoading({
  isFullScreen = true,
  fillDuration = 1.8,
  className = '',
}: AppLoadingProps) {
  const content = (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Pure Hero Logo Loading (Bear with internal flow fill) */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
        {/* Layer 1: Ghost Base Silhouette */}
        <div className="absolute inset-0 w-full h-full text-[#5D4037]/15 dark:text-[#FDFBF7]/20 pointer-events-none transition-opacity duration-300">
          <BearLogoSvg />
        </div>

        {/* Layer 2: Synchronized Flow Fill inside the Bear icon */}
        <motion.div
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{
            duration: fillDuration,
            ease: [0.25, 1, 0.5, 1],
            delay: 0.05,
            repeat: Infinity,
            repeatDelay: 0.3,
          }}
          className="absolute inset-0 w-full h-full pointer-events-none text-[#5D4037] dark:text-[#FDFBF7]"
        >
          <BearLogoSvg />
        </motion.div>
      </div>
    </div>
  );

  if (isFullScreen) {
    return (
      <div
        id="bobbies-loading-screen"
        aria-live="polite"
        role="status"
        className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#FDFBF7] dark:bg-[#1A1816] px-6 select-none transition-colors duration-300 ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      role="status"
      className={`relative flex flex-col items-center justify-center p-8 transition-colors duration-300 ${className}`}
    >
      {content}
    </div>
  );
}

export default AppLoading;
