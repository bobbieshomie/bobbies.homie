'use client';

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = true,
  loading = false,
}: ConfirmDialogProps) {
  const { language } = useLanguage();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-dm-sans animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[340px] bg-[#FDFBF7] dark:bg-[#1E1C1A] rounded-[24px] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-2xl overflow-hidden p-5 animate-scale-up space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 relative">
          <div className="w-10 h-10 rounded-[14px] bg-[#FFEBEE] dark:bg-[#3D1F1F] text-[#C62828] dark:text-[#EF9A9A] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-outfit text-[16px] font-bold text-[#5D4037] dark:text-[#DDD7D2] leading-tight">
              {title || (language === 'th' ? 'ยืนยันการลบ?' : 'Confirm Delete?')}
            </h3>
            <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87] mt-1 leading-normal">
              {description || (language === 'th' ? 'ข้อมูลนี้จะถูกลบและไม่สามารถกู้คืนได้' : 'This action cannot be undone.')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[14px] bg-[#F4EFEA] dark:bg-[#2A2724] border border-[#D7CCC8]/60 dark:border-[#3D3835] text-[#8D6E63] dark:text-[#948D87] font-dm-sans text-[13px] font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelLabel || (language === 'th' ? 'ยกเลิก' : 'Cancel')}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-[14px] text-white font-dm-sans text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50 ${
              isDestructive
                ? 'bg-[#C62828] hover:bg-[#B71C1C]'
                : 'bg-[#5D4037] dark:bg-[#DDD7D2] dark:text-[#1A1816]'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 stroke-white" />
            <span>{confirmLabel || (language === 'th' ? 'ยืนยันลบ' : 'Delete')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
