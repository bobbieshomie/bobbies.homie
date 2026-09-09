'use client';

import React from 'react';
import { RiBearSmileFill } from '@remixicon/react';
import { Crown as IconoirCrown } from 'iconoir-react';

interface AppLoadingProps {
  message?: string;
  subMessage?: string;
  isFullScreen?: boolean;
}

export function AppLoading({
  message = 'Bobbies Homie',
  subMessage = 'อบอุ่นในทุกวันของการอยู่ร่วมกัน',
  isFullScreen = true,
}: AppLoadingProps) {
  return (
    <div
      className={`${
        isFullScreen
          ? 'fixed inset-0 z-[9999]'
          : 'w-full min-h-[60vh]'
      } flex flex-col items-center justify-center bg-[#FDFBF7] dark:bg-[#1A1816] px-6 select-none transition-colors duration-300`}
    >
      {/* Ambient background soft glow */}
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#E0533C]/10 via-[#FFB300]/10 to-transparent blur-3xl pointer-events-none animate-logo-glow" />

      {/* Main Container */}
      <div className="relative flex flex-col items-center z-10 space-y-6">
        {/* Animated Logo Mark */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing ring */}
          <div className="absolute -inset-2.5 rounded-[32px] bg-gradient-to-tr from-[#FFB300]/25 to-[#E0533C]/20 blur-md animate-logo-glow" />

          {/* Logo Squircle Box */}
          <div className="relative w-20 h-20 rounded-[26px] bg-[#F4EFEA] dark:bg-[#25201D] border-2 border-[#D7CCC8] dark:border-[#3E322A] shadow-[0px_10px_28px_rgba(93,64,55,0.08)] dark:shadow-[0px_10px_28px_rgba(0,0,0,0.4)] flex items-center justify-center animate-logo-breathe">
            {/* Crown accent on top-right */}
            <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-gradient-to-tr from-[#FFB300] to-[#FFE082] text-[#5D4037] flex items-center justify-center shadow-sm ring-2 ring-[#FDFBF7] dark:ring-[#1A1816]">
              <IconoirCrown className="w-4 h-4 text-[#5D4037]" width="16" height="16" strokeWidth={2.2} />
            </div>

            {/* Bear face */}
            <RiBearSmileFill className="w-11 h-11 fill-[#5D4037] dark:fill-[#FDFBF7] transition-colors" />
          </div>
        </div>

        {/* Brand Text */}
        <div className="text-center space-y-1.5">
          <h1 className="font-outfit font-black text-[24px] tracking-tight text-[#5D4037] dark:text-[#FDFBF7]">
            {message}
          </h1>
          {subMessage && (
            <p className="font-dm-sans text-[12.5px] font-medium text-[#8D6E63] dark:text-[#A89F91]">
              {subMessage}
            </p>
          )}
        </div>

        {/* Smooth Loading Progress Bar */}
        <div className="w-32 h-1.5 rounded-full bg-[#EFEBE9] dark:bg-[#2D2622] overflow-hidden relative shadow-inner">
          <div className="absolute inset-y-0 w-16 rounded-full bg-gradient-to-r from-[#E0533C] via-[#FFB300] to-[#E0533C] animate-progress-slide" />
        </div>
      </div>
    </div>
  );
}
