'use client';

import React, { useState, useEffect } from 'react';
import { AppLoading } from './app-loading';

export function AppSplash() {
  const [showSplash, setShowSplash] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    try {
      // Check if the user already saw the splash during this session
      const alreadyOpened = sessionStorage.getItem('homie_app_opened');
      if (alreadyOpened) {
        return;
      }
      
      // First time opening the app in this session
      sessionStorage.setItem('homie_app_opened', 'true');
      setShowSplash(true);

      const timer = setTimeout(() => {
        setIsFading(true);
        const hideTimer = setTimeout(() => {
          setShowSplash(false);
        }, 450); // match transition duration
        return () => clearTimeout(hideTimer);
      }, 1350);

      return () => clearTimeout(timer);
    } catch {
      // safe fallback if storage is restricted
    }
  }, []);

  if (!showSplash) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] pointer-events-none transition-opacity duration-400 ease-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <AppLoading isFullScreen={true} />
    </div>
  );
}
