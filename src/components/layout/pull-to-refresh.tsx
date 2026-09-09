'use client';

import React, { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RiBearSmileFill } from '@remixicon/react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
const RESISTANCE = 0.45;

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const router = useRouter();
  const { language } = useLanguage();

  const containerRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    // Only allow pull-to-refresh if scrolled to top
    if (container && container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;
    const container = containerRef.current;
    if (container && container.scrollTop > 0) {
      isDraggingRef.current = false;
      setPullY(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Apply resistance
      const nextY = Math.min(diff * RESISTANCE, MAX_PULL);
      setPullY(nextY);

      if (nextY >= PULL_THRESHOLD && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // Subtle haptic tick when reaching threshold
        try {
          navigator.vibrate(10);
        } catch {}
      }
    } else {
      setPullY(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (pullY >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullY(PULL_THRESHOLD);

      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          // Default refresh: Next.js router refresh + soft delay for smooth UX
          router.refresh();
          await new Promise((res) => setTimeout(res, 800));
        }
      } catch (err) {
        console.warn('Pull-to-refresh error:', err);
      } finally {
        setIsRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  const isReadyToRelease = pullY >= PULL_THRESHOLD;
  const rotation = Math.min(pullY * 4, 360);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1 w-full overflow-y-auto pb-32 overscroll-y-contain no-scrollbar"
    >
      {/* Pull Indicator Area */}
      <div
        style={{
          height: `${pullY}px`,
          opacity: pullY > 10 ? 1 : 0,
          transition: isDraggingRef.current ? 'none' : 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="w-full flex items-center justify-center overflow-hidden pointer-events-none select-none"
      >
        <div className="flex items-center gap-2 py-2 px-3 rounded-full bg-[#F4EFEA]/90 dark:bg-[#25201D]/90 backdrop-blur-md border border-[#D7CCC8]/70 dark:border-[#3E322A]/70 shadow-sm text-xs font-semibold text-[#5D4037] dark:text-[#DDD7D2]">
          {isRefreshing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#8D6E63] dark:text-[#BCAAA4]" />
              <span className="text-[11px] font-medium">
                {language === 'th' ? 'กำลังรีเฟรช...' : 'Refreshing...'}
              </span>
            </>
          ) : (
            <>
              <div
                style={{
                  transform: `rotate(${rotation}deg) scale(${isReadyToRelease ? 1.2 : 1})`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="w-4 h-4 flex items-center justify-center text-[#8D6E63] dark:text-[#DDD7D2]"
              >
                <RiBearSmileFill className="w-4 h-4 fill-current" />
              </div>
              <span className="text-[11px] font-medium">
                {isReadyToRelease
                  ? (language === 'th' ? 'ปล่อยเพื่อรีเฟรช ✨' : 'Release to refresh ✨')
                  : (language === 'th' ? 'ดึงลงเพื่อรีเฟรช' : 'Pull down to refresh')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
