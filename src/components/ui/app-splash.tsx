'use client';

import React, { useState, useEffect } from 'react';
import { AppLoading } from './app-loading';

export function AppSplash() {
  const [mounted, setMounted] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Give enough time for the pleasant branded opening impression (650ms)
    const timer = setTimeout(() => {
      setIsFading(true);
      const hideTimer = setTimeout(() => {
        setShowSplash(false);
      }, 400); // match transition duration
      return () => clearTimeout(hideTimer);
    }, 650);

    return () => clearTimeout(timer);
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
