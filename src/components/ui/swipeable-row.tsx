'use client';

import React, { useState, useRef, useCallback, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

interface SwipeableRowProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  className = '',
  disabled = false,
}: SwipeableRowProps) {
  const { language } = useLanguage();
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalRef = useRef<boolean | null>(null);

  // Width needed for actions
  const actionCount = (onEdit ? 1 : 0) + (onDelete ? 1 : 0);
  const ACTION_WIDTH = 58;
  const MAX_SWIPE = actionCount * ACTION_WIDTH;
  const THRESHOLD = 35;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || actionCount === 0) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    isHorizontalRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || disabled || actionCount === 0) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;

    // Determine swipe direction
    if (isHorizontalRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (!isHorizontalRef.current) return;

    // Calculate new position
    const baseOffset = isOpen ? -MAX_SWIPE : 0;
    const targetOffset = baseOffset + deltaX;

    // Clamp between -MAX_SWIPE - 20 (slight overscroll bounce) and 0
    if (targetOffset <= 0 && targetOffset >= -MAX_SWIPE - 25) {
      setOffsetX(targetOffset);
    }
  };

  const closeActions = useCallback(() => {
    setOffsetX(0);
    setIsOpen(false);
  }, []);

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (isOpen) {
      // If currently open and dragged right, close it
      if (offsetX > -MAX_SWIPE + THRESHOLD) {
        closeActions();
      } else {
        setOffsetX(-MAX_SWIPE);
      }
    } else {
      // If currently closed and dragged left past threshold, snap open
      if (offsetX < -THRESHOLD) {
        setOffsetX(-MAX_SWIPE);
        setIsOpen(true);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(15);
          } catch {}
        }
      } else {
        closeActions();
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeActions();
    onEdit?.();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeActions();
    onDelete?.();
  };

  return (
    <div className={`relative overflow-hidden rounded-[18px] select-none ${className}`}>
      {/* Background action buttons revealed when swiped */}
      {actionCount > 0 && (
        <div 
          className="absolute inset-y-0 right-0 flex items-stretch z-0"
          style={{ width: `${MAX_SWIPE}px` }}
        >
          {onEdit && (
            <button
              type="button"
              onClick={handleEditClick}
              title={editLabel || (language === 'th' ? 'แก้ไข' : 'Edit')}
              className="flex-1 flex flex-col items-center justify-center bg-[#8D6E63] hover:bg-[#7D5E53] active:bg-[#6D4E43] text-white transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4 stroke-current" />
              <span className="text-[10px] font-semibold mt-1">
                {editLabel || (language === 'th' ? 'แก้ไข' : 'Edit')}
              </span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              title={deleteLabel || (language === 'th' ? 'ลบ' : 'Delete')}
              className="flex-1 flex flex-col items-center justify-center bg-[#E53935] hover:bg-[#D32F2F] active:bg-[#C62828] text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 stroke-current" />
              <span className="text-[10px] font-semibold mt-1">
                {deleteLabel || (language === 'th' ? 'ลบ' : 'Delete')}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Foreground swiping content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isOpen) closeActions();
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="relative z-10 w-full"
      >
        {children}
      </div>
    </div>
  );
}
