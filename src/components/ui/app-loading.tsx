'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Crown as IconoirCrown } from 'iconoir-react';

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
  message = 'Bobbies Homie',
  subMessage = 'อบอุ่นในทุกวันของการอยู่ร่วมกัน',
  isFullScreen = true,
  fillDuration = 1.8,
  showText = true,
  className = '',
}: AppLoadingProps) {
  const content = (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* 1. Pure Hero Logo Loading (Bear with internal flow fill) */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
        {/* Ambient soft glow behind the logo */}
        <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#FFB300]/15 via-[#E0533C]/10 to-transparent blur-2xl pointer-events-none" />

        {/* Pastel crown on the top-right ear */}
        <div className="absolute -top-3 -right-2 z-20 pointer-events-none drop-shadow-sm">
          <IconoirCrown
            className="w-6 h-6 text-[#F6D365] fill-[#FFF3C4] dark:fill-[#F6D365]/30"
            width="24"
            height="24"
            strokeWidth={2}
          />
        </div>

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
          className="absolute inset-0 w-full h-full pointer-events-none text-[#5D4037] dark:text-[#FDFBF7] drop-shadow-[0_4px_16px_rgba(93,64,55,0.12)] dark:drop-shadow-[0_4px_16px_rgba(255,255,255,0.25)]"
        >
          <BearLogoSvg />
        </motion.div>
      </div>

      {/* 2. Brand Message / Status */}
      <div className="text-center space-y-1 mt-6">
        <h1 className="font-outfit font-black text-[22px] tracking-tight text-[#5D4037] dark:text-[#FDFBF7]">
          {message}
        </h1>
        {subMessage && (
          <p className="font-dm-sans text-[12px] font-medium text-[#8D6E63] dark:text-[#A89F91]">
            {subMessage}
          </p>
        )}
      </div>

      {/* 3. Subtle loading... indicator */}
      {showText && (
        <div className="relative mt-2.5 flex items-center justify-center">
          <span className="text-[11px] font-dm-sans font-semibold tracking-[0.22em] lowercase text-[#8D6E63]/40 dark:text-[#FDFBF7]/30 select-none animate-pulse">
            loading...
          </span>
        </div>
      )}
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
